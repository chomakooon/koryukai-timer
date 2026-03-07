export type SoundType = 'beep' | 'chime' | 'bell';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private isEnabled = false;
  private soundEnabled = true;
  private soundType: SoundType = 'chime';

  setSoundEnabled(enabled: boolean) { this.soundEnabled = enabled; }
  setSoundType(type: SoundType) { this.soundType = type; }

  async initialize(): Promise<boolean> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // iOS Safari等のためのAudioContextアンロック処理（無音を再生）
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      gain.gain.value = 0; // 無音
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.01);

      this.isEnabled = true;
      return true;
    } catch (error) {
      console.error('AudioContext初期化エラー:', error);
      return false;
    }
  }

  playFinishSound(forcePlay = false): void {
    if (!this.audioContext || !this.isEnabled) return;
    if (!this.soundEnabled && !forcePlay) return;

    try {
      const ctx = this.audioContext;
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
