/** Creating this controller does not create or start an AudioContext. */
export class TimerAudio {
  private context: AudioContext | null = null;
  private disposed = false;

  /** Call only from a click/keyboard handler, before any unrelated await. */
  async enable(): Promise<boolean> {
    if (this.disposed || typeof AudioContext === 'undefined') return false;
    try {
      const context = this.context ??= new AudioContext();
      if (context.state === 'suspended') await context.resume();
      return !this.disposed && context.state === 'running';
    } catch {
      // The timer can continue even when the browser cannot enable sound.
      return false;
    }
  }

  /** An automatic alarm never initializes or resumes audio. */
  ring(): void {
    const context = this.context;
    if (this.disposed || !context || context.state !== 'running') return;
    const now = context.currentTime;
    [523.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.2;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  }

  dispose(): void {
    this.disposed = true;
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
