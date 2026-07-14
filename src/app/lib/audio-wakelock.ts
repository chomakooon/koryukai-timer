export type SoundType = 'beep' | 'chime' | 'bell' | 'ringtone' | 'emergency' | 'cat' | 'dog';

// ===== サウンド合成 =====
// 各サウンドを dest に t0 秒から予約する。戻り値は音の実長（秒）。
// リアルタイムのAudioContextにもOfflineAudioContextにも使える。
function scheduleSound(ctx: BaseAudioContext, dest: AudioNode, type: SoundType, t0: number): number {
  if (type === 'beep') {
    // 短く連続する高音（ピピピッ）
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(dest);

      osc.type = 'square'; // 鋭い波形で目立たせる
      osc.frequency.setValueAtTime(1200, t0 + i * 0.15);

      gain.gain.setValueAtTime(0, t0 + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.3, t0 + i * 0.15 + 0.01);
      gain.gain.setValueAtTime(0.3, t0 + i * 0.15 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + i * 0.15 + 0.1);

      osc.start(t0 + i * 0.15);
      osc.stop(t0 + i * 0.15 + 0.1);
    }
    return 0.45;
  }

  if (type === 'chime') {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.frequency.setValueAtTime(880, t0); // A5
    gain1.gain.setValueAtTime(0, t0);
    gain1.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.01, t0 + 0.8);
    osc1.start(t0);
    osc1.stop(t0 + 0.8);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.frequency.setValueAtTime(740, t0 + 0.4); // F#5
    gain2.gain.setValueAtTime(0, t0 + 0.4);
    gain2.gain.linearRampToValueAtTime(0.3, t0 + 0.41);
    gain2.gain.exponentialRampToValueAtTime(0.01, t0 + 1.2);
    osc2.start(t0 + 0.4);
    osc2.stop(t0 + 1.2);
    return 1.2;
  }

  if (type === 'bell') {
    [880, 1318, 1567].forEach((freq, i) => { // A5, E6, G6
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(dest);
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.2 / (i + 1), t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + 1.5 - i * 0.2);
      osc.start(t0);
      osc.stop(t0 + 1.5);
    });
    return 1.5;
  }

  if (type === 'ringtone') {
    const melody = [659.25, 659.25, 0, 659.25, 0, 523.25, 659.25, 0, 783.99]; // E5, E5, E5, C5, E5, G5
    const timing = [0, 0.15, 0.3, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05];
    melody.forEach((freq, i) => {
      if (freq === 0) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(dest);
      osc.frequency.setValueAtTime(freq, t0 + timing[i]);
      gain.gain.setValueAtTime(0, t0 + timing[i]);
      gain.gain.linearRampToValueAtTime(0.2, t0 + timing[i] + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + timing[i] + 0.14);
      osc.start(t0 + timing[i]);
      osc.stop(t0 + timing[i] + 0.15);
    });
    return 1.2;
  }

  if (type === 'emergency') {
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(gain);
      gain.connect(dest);
      osc.frequency.setValueAtTime(800, t0 + i * 0.25);
      osc.frequency.exponentialRampToValueAtTime(400, t0 + i * 0.25 + 0.2);
      gain.gain.setValueAtTime(0, t0 + i * 0.25);
      gain.gain.linearRampToValueAtTime(0.2, t0 + i * 0.25 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + i * 0.25 + 0.24);
      osc.start(t0 + i * 0.25);
      osc.stop(t0 + i * 0.25 + 0.25);
    }
    return 1.0;
  }

  if (type === 'cat') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(dest);
    osc.frequency.setValueAtTime(400, t0);
    osc.frequency.exponentialRampToValueAtTime(1000, t0 + 0.2);
    osc.frequency.exponentialRampToValueAtTime(800, t0 + 0.5);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.2, t0 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.6);
    osc.start(t0);
    osc.stop(t0 + 0.6);
    return 0.6;
  }

  // dog: 4連の「ワンワンワンワン」
  for (let j = 0; j < 4; j++) {
    const startTime = t0 + j * 0.25;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(dest);

    osc.frequency.setValueAtTime(300, startTime);
    osc.frequency.exponentialRampToValueAtTime(150, startTime + 0.12);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.18);

    osc.start(startTime);
    osc.stop(startTime + 0.2);

    // 吠え声の「ざらつき」を出すノイズ成分
    const noise = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(150, startTime);
    noise.connect(noiseGain);
    noiseGain.connect(dest);

    noiseGain.gain.setValueAtTime(0, startTime);
    noiseGain.gain.linearRampToValueAtTime(0.15, startTime + 0.04);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

    noise.start(startTime);
    noise.stop(startTime + 0.2);
  }
  return 0.95;
}

// ===== WAVエンコード =====
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const len = samples.length;
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + len * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// ===== AudioManager =====
// 方式: 全サウンドを起動時に1本のWAV（音声スプライト）へオフライン合成し、
// 単一の<audio>要素の再生位置を切り替えて鳴らす。
// - 毎回まったく同じ波形が再生される（オシレータの停止漏れ・重なり・
//   不協和音が構造的に起きない）
// - <audio>要素の再生はiOSで「メディア再生」扱いになり、
//   マナーモードでも鳴る（動画・音楽と同じ）
// - 要素はSTARTタップ時に一度再生してアンロックしておく
const SOUND_ORDER: SoundType[] = ['beep', 'chime', 'bell', 'ringtone', 'emergency', 'cat', 'dog'];
const SPRITE_LEAD = 0.5; // 先頭の無音（アンロック再生用）
const SLOT_SEC = 2.0;    // 各サウンドの割当スロット長（音のあとは無音）
const SAMPLE_RATE = 22050;

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private isEnabled = false;
  private soundEnabled = true;
  private soundType: SoundType = 'beep';

  private spriteEl: HTMLAudioElement | null = null;
  private spriteOffsets: Partial<Record<SoundType, { start: number; dur: number }>> = {};
  private spriteReady = false;
  private stopTimer: number | null = null;

  // フォールバック（スプライト再生不能時）用
  private activeSoundGain: GainNode | null = null;

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

  // iOSでは interrupted 状態の resume() が永久に解決しないことがあるため、
  // 必ずタイムアウト付きで待つ。
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

  private async buildSprite(): Promise<void> {
    if (this.spriteReady) return;
    const total = SPRITE_LEAD + SLOT_SEC * SOUND_ORDER.length;
    const offline = new OfflineAudioContext(1, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE);
    SOUND_ORDER.forEach((type, i) => {
      const start = SPRITE_LEAD + i * SLOT_SEC;
      const dur = scheduleSound(offline, offline.destination, type, start);
      this.spriteOffsets[type] = { start, dur };
    });
    const rendered = await offline.startRendering();
    const url = URL.createObjectURL(audioBufferToWavBlob(rendered));
    const el = new Audio(url);
    el.preload = 'auto';
    (el as any).playsInline = true;
    el.setAttribute('playsinline', '');
    this.spriteEl = el;
    this.spriteReady = true;
  }

  async initialize(): Promise<boolean> {
    try {
      await this.buildSprite();

      // ユーザージェスチャー中に一度再生して<audio>要素をアンロックする。
      // 先頭0.5秒は無音なので何も聞こえない。
      const el = this.spriteEl;
      if (el) {
        try {
          el.currentTime = 0;
          await Promise.race([
            el.play(),
            new Promise<void>((resolve) => setTimeout(resolve, 400))
          ]);
        } catch {
          // 再生拒否でもスプライト自体は使える可能性があるので続行
        }
        window.setTimeout(() => { try { el.pause(); } catch { /* noop */ } }, 400);
      }

      // フォールバック用のWeb Audioもジェスチャー中に起こしておく
      const ctx = this.ensureContext();
      if (ctx) await this.resumeWithTimeout(500);

      this.isEnabled = true;
      return true;
    } catch (error) {
      console.error('音声初期化エラー:', error);
      // スプライトが作れなくてもWeb Audioフォールバックで動かす
      this.isEnabled = this.ensureContext() !== null;
      return this.isEnabled;
    }
  }

  async resume(): Promise<void> {
    if (!this.audioContext) return;
    await this.resumeWithTimeout(500);
  }

  // タイマー稼働中の定期キープアライブ（Timer.tsxから25秒ごとに呼ばれる）
  async playSilent(): Promise<void> {
    await this.resume();
  }

  async playFinishSound(forcePlay = false): Promise<void> {
    if (!this.isEnabled) return;
    if (!this.soundEnabled && !forcePlay) return;

    const offset = this.spriteReady ? this.spriteOffsets[this.soundType] : undefined;
    const el = this.spriteEl;

    if (el && offset) {
      try {
        if (this.stopTimer !== null) {
          window.clearTimeout(this.stopTimer);
          this.stopTimer = null;
        }
        // 前の再生が残っていても、同一要素なので頭出しし直すだけ（重ならない）
        try { el.pause(); } catch { /* noop */ }
        el.currentTime = offset.start;
        await el.play();
        // 音の終わりで止める（スロット末尾は無音なので多少遅れても静か）
        this.stopTimer = window.setTimeout(() => {
          try { el.pause(); } catch { /* noop */ }
        }, Math.ceil((offset.dur + 0.3) * 1000));
        return;
      } catch (e) {
        console.error('スプライト再生エラー（フォールバックします）:', e);
      }
    }

    await this.playFallback();
  }

  // <audio>要素での再生に失敗した場合のみ使う直接出力（旧方式）
  private async playFallback(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      await this.resumeWithTimeout(400);

      // 前回の音が万一止まり損ねていても、ここで物理的に切断する
      if (this.activeSoundGain) {
        try { this.activeSoundGain.disconnect(); } catch { /* noop */ }
      }
      const master = ctx.createGain();
      master.connect(ctx.destination);
      this.activeSoundGain = master;
      // どの音も1.5秒以内に終わる。3秒後には無条件で切断する保険
      window.setTimeout(() => {
        if (this.activeSoundGain === master) this.activeSoundGain = null;
        try { master.disconnect(); } catch { /* noop */ }
      }, 3000);

      scheduleSound(ctx, master, this.soundType, ctx.currentTime);
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
