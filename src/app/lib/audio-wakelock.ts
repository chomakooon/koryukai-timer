export type SoundType = 'beep' | 'chime' | 'bell' | 'ringtone' | 'emergency' | 'cat' | 'dog';

// 無音の1秒WAVを実行時に生成する（外部ファイル不要・完全無音）
function createSilentWavUrl(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1秒
  const buf = new ArrayBuffer(44 + numSamples * 2);
  const v = new DataView(buf);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, numSamples * 2, true);
  // サンプル部は0のまま = 無音
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private isEnabled = false;
  private soundEnabled = true;
  private soundType: SoundType = 'chime';
  private keepAliveEl: HTMLAudioElement | null = null;

  setSoundEnabled(enabled: boolean) { this.soundEnabled = enabled; }
  setSoundType(type: SoundType) { this.soundType = type; }

  // ブラウザにcloseされたAudioContextは復活しないので作り直す
  private ensureContext(): AudioContext | null {
    if (this.audioContext && this.audioContext.state === 'closed') {
      this.audioContext = null;
    }
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return this.audioContext;
  }

  // iOSはマナーモード中、Web Audioの音をOSレベルで消す。
  // 無音のHTMLAudioElementをループ再生しておくとオーディオセッションが
  // 「メディア再生」扱いになり、マナーモードでもWeb Audioの音が鳴る。
  // セッションが維持されるため interrupted への遷移も起きにくくなる。
  private startKeepAliveElement(): void {
    try {
      if (!this.keepAliveEl) {
        const el = new Audio(createSilentWavUrl());
        el.loop = true;
        el.preload = 'auto';
        (el as any).playsInline = true;
        el.setAttribute('playsinline', '');
        this.keepAliveEl = el;
      }
      if (this.keepAliveEl.paused) {
        // ユーザージェスチャー外だと拒否されることがあるが、次のタップで再試行される
        this.keepAliveEl.play().catch(() => {});
      }
    } catch {
      // noop
    }
  }

  // iOSでは interrupted 状態の resume() が永久に解決しないことがあるため、
  // 必ずタイムアウト付きで待つ。タイムアウトしても後続の再生予約は行う
  // （コンテキスト復帰時に遅れて鳴る方が、無音より良い）。
  private async resumeWithTimeout(ms: number): Promise<void> {
    const ctx = this.audioContext;
    if (!ctx) return;
    const state = ctx.state as AudioContextState | 'interrupted';
    if (state === 'suspended' || state === 'interrupted') {
      await Promise.race([
        ctx.resume().catch((e) => console.error('AudioContext resume error:', e)),
        new Promise<void>((resolve) => setTimeout(resolve, ms))
      ]);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return false;

      await this.resumeWithTimeout(1000);

      // iOS Safari等のためのAudioContextアンロック処理。
      // 無音オシレータだと古いiOSで初回の音が抜けることがあるため、
      // 空のAudioBufferを実際に再生してハードウェアを起こす（定番のアンロック手法）。
      this.unlock();
      this.startKeepAliveElement();
      await this.playSilent();

      this.isEnabled = true;
      return true;
    } catch (error) {
      console.error('AudioContext初期化エラー:', error);
      return false;
    }
  }

  // 空バッファを1サンプル再生してオーディオ出力をアンロックする（特にiOS初回対策）
  private unlock(): void {
    if (!this.audioContext) return;
    try {
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch {
      // noop
    }
  }

  async resume(): Promise<void> {
    if (!this.audioContext) return;
    await this.resumeWithTimeout(500);
    // 割り込みで止まった無音ループもユーザー操作のタイミングで復帰させる
    if (this.isEnabled) this.startKeepAliveElement();
  }

  async playSilent(): Promise<void> {
    if (!this.audioContext) return;
    try {
      // iOS等でマナーモード解除/着信割り込み後に interrupted/suspended に
      // 落ちている場合があるので、無音再生前に resume を試みる
      await this.resume();
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      gain.gain.value = 0; // 無音
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.01);
    } catch (e) {
      // noop
    }
  }

  async playFinishSound(forcePlay = false): Promise<void> {
    if (!this.isEnabled) return;
    if (!this.soundEnabled && !forcePlay) return;
    // コンテキストがcloseされていたら作り直す
    const ensured = this.ensureContext();
    if (!ensured) return;

    try {
      const ctx = ensured;

      // 再生前に状態を確認し、停止/中断していたら再開を試みる
      // (iOSはマナーモード切替や着信で 'interrupted' に遷移することがある)。
      // resume()がハングしても音の予約自体は行う（復帰時に遅れて鳴る）。
      await this.resumeWithTimeout(400);
      if (this.isEnabled) this.startKeepAliveElement();

      const now = ctx.currentTime;

      if (this.soundType === 'beep') {
        // 短く連続する高音（ピピピッ）
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'square'; // 鋭い波形で目立たせる
          osc.frequency.setValueAtTime(1200, now + i * 0.15); // ちょっと高めの音

          gain.gain.setValueAtTime(0, now + i * 0.15);
          gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.01);
          gain.gain.setValueAtTime(0.3, now + i * 0.15 + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.1);

          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.1);
        }
      } else if (this.soundType === 'chime') {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.setValueAtTime(880, now); // A5
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc1.start(now);
        osc1.stop(now + 0.8);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(740, now + 0.4); // F#5
        gain2.gain.setValueAtTime(0, now + 0.4);
        gain2.gain.linearRampToValueAtTime(0.3, now + 0.41);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        osc2.start(now + 0.4);
        osc2.stop(now + 1.2);
      } else if (this.soundType === 'bell') {
        [880, 1318, 1567].forEach((freq, i) => { // A5, E6, G6
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.2 / (i + 1), now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5 - i * 0.2);
          osc.start(now);
          osc.stop(now + 1.5);
        });
      } else if (this.soundType === 'ringtone') {
        const melody = [659.25, 659.25, 0, 659.25, 0, 523.25, 659.25, 0, 783.99]; // E5, E5, E5, C5, E5, G5
        const timing = [0, 0.15, 0.3, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05];
        melody.forEach((freq, i) => {
          if (freq === 0) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, now + timing[i]);
          gain.gain.setValueAtTime(0, now + timing[i]);
          gain.gain.linearRampToValueAtTime(0.2, now + timing[i] + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.01, now + timing[i] + 0.14);
          osc.start(now + timing[i]);
          osc.stop(now + timing[i] + 0.15);
        });
      } else if (this.soundType === 'emergency') {
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(800, now + i * 0.25);
          osc.frequency.exponentialRampToValueAtTime(400, now + i * 0.25 + 0.2);
          gain.gain.setValueAtTime(0, now + i * 0.25);
          gain.gain.linearRampToValueAtTime(0.2, now + i * 0.25 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.25 + 0.24);
          osc.start(now + i * 0.25);
          osc.stop(now + i * 0.25 + 0.25);
        }
      } else if (this.soundType === 'cat') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (this.soundType === 'dog') {
        // Quadruple bark: "Woof-Woof-Woof-Woof"
        for (let j = 0; j < 4; j++) {
          const startTime = now + j * 0.25;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.frequency.setValueAtTime(300, startTime);
          osc.frequency.exponentialRampToValueAtTime(150, startTime + 0.12);

          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.18);

          osc.start(startTime);
          osc.stop(startTime + 0.2);

          // Add a bit of noise for the "roughness" of the bark
          const noise = ctx.createOscillator();
          const noiseGain = ctx.createGain();
          noise.type = 'sawtooth';
          noise.frequency.setValueAtTime(150, startTime);
          noise.connect(noiseGain);
          noiseGain.connect(ctx.destination);

          noiseGain.gain.setValueAtTime(0, startTime);
          noiseGain.gain.linearRampToValueAtTime(0.15, startTime + 0.04);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

          noise.start(startTime);
          noise.stop(startTime + 0.2);
        }
      }
    } catch (e) {
      console.error('音声再生エラー:', e);
    }
  }

  isAudioEnabled(): boolean {
    return this.isEnabled;
  }
}

export class WakeLockManager {
  private wakeLock: any = null;
  private isSupported = false;

  constructor() {
    this.isSupported = 'wakeLock' in navigator;
  }

  async request(): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      return true;
    } catch {
      return false;
    }
  }

  async release(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {
        // noop
      } finally {
        this.wakeLock = null;
      }
    }
  }

  isWakeLockSupported(): boolean {
    return this.isSupported;
  }

  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }
}
