export class AudioManager {
  private audioContext: AudioContext | null = null;
  private isEnabled = false;

  async initialize(): Promise<boolean> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.isEnabled = true;
      return true;
    } catch (error) {
      console.error('AudioContext初期化エラー:', error);
      return false;
    }
  }

  playFinishSound(): void {
    if (!this.audioContext || !this.isEnabled) {
      return;
    }

    try {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(800, now);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch (error) {
      console.error('音声再生エラー:', error);
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
