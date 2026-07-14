export type SoundType = 'beep' | 'chime' | 'bell' | 'ringtone' | 'emergency' | 'cat' | 'dog';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private isEnabled = false;
  private soundEnabled = true;
  private soundType: SoundType = 'chime';
  // iOSマナーモード対策: Web Audioを ctx.destination に直接出すと
  // マナーモード中はOSに消される。MediaStream経由で<audio>要素に流すと
  // 動画・音楽と同じ「メディア再生」扱いになり、マナーモードでも鳴る。
  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private outputEl: HTMLAudioElement | null = null;

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

  // MediaStream出力経路をセットアップし、<audio>要素の再生を保証する。
  // 再生が止まっていたら再開を試みる（ユーザージェスチャー外だと
  // 拒否されることがあるが、次のタップ時のresume()で再試行される）。
  private async ensureOutput(ctx: AudioContext): Promise<void> {
    try {
      if (!this.mediaDest || this.mediaDest.context !== ctx) {
        this.mediaDest = ctx.createMediaStreamDestination();
        if (!this.outputEl) {
          const el = new Audio();
          (el as any).playsInline = true;
          el.setAttribute('playsinline', '');
          this.outputEl = el;
        }
        this.outputEl.srcObject = this.mediaDest.stream;
      }
      if (this.outputEl && this.outputEl.paused) {
        // play()が返らない/拒否される環境でも先へ進めるようタイムアウト付き
        await Promise.race([
          this.outputEl.play().catch(() => {}),
          new Promise<void>((resolve) => setTimeout(resolve, 300))
        ]);
      }
    } catch {
      // MediaStream非対応環境では直接出力にフォールバックする
      this.mediaDest = null;
    }
  }

  // 音の出力先。<audio>経由が生きていればそちら（マナーモードでも鳴る）、
  // だめなら ctx.destination へ直接（通常の再生）。
  private outputNode(ctx: AudioContext): AudioNode {
    if (
      this.mediaDest &&
      this.mediaDest.context === ctx &&
      this.outputEl &&
      !this.outputEl.paused
    ) {
      return this.mediaDest;
    }
    return ctx.destination;
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
      await this.ensureOutput(ctx);
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
    // 割り込みで止まった出力用<audio>もユーザー操作のタイミングで復帰させる
    if (this.isEnabled) await this.ensureOutput(this.audioContext);
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
      gain.connect(this.outputNode(this.audioContext));
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
      await this.ensureOutput(ctx);

      const out = this.outputNode(ctx);
      const now = ctx.currentTime;

      if (this.soundType === 'beep') {
        // 短く連続する高音（ピピピッ）
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(out);

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
        gain1.connect(out);
        osc1.frequency.setValueAtTime(880, now); // A5
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc1.start(now);
        osc1.stop(now + 0.8);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(out);
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
          gain.connect(out);
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
          gain.connect(out);
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
          gain.connect(out);
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
        gain.connect(out);
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
          gain.connect(out);

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
          noiseGain.connect(out);

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
