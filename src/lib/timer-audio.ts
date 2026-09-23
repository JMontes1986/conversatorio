/** Creating this controller does not create or start an AudioContext. */
export class TimerAudio {
  private context: AudioContext | null = null;
  private disposed = false;

  /** Call from a user gesture whenever possible so later automatic alarms are allowed. */
  async enable(): Promise<boolean> {
    if (this.disposed || typeof window === 'undefined') return false;

    const AudioContextCtor =
      window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return false;

    try {
      const context = this.context ??= new AudioContextCtor();
      if (context.state === 'suspended') await context.resume();
      return !this.disposed && context.state === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Ring with a short, bright three-strike bell.
   * Requires the AudioContext to have been enabled by a prior user gesture.
   */
  ring(): boolean {
    const context = this.context;
    if (this.disposed || !context || context.state !== 'running') return false;

    const now = context.currentTime;
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();

    compressor.threshold.setValueAtTime(-12, now);
    compressor.knee.setValueAtTime(12, now);
    compressor.ratio.setValueAtTime(6, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.25, now);

    // Louder than the previous 0.2 gain, while the compressor prevents harsh clipping.
    master.gain.setValueAtTime(0.72, now);
    master.connect(compressor);
    compressor.connect(context.destination);

    const strikes = [
      { at: 0.00, frequency: 659.25 },
      { at: 0.24, frequency: 880.00 },
      { at: 0.48, frequency: 1046.50 },
    ];

    let remaining = strikes.length * 2;

    const cleanup = () => {
      remaining -= 1;
      if (remaining <= 0) {
        try { master.disconnect(); } catch {}
        try { compressor.disconnect(); } catch {}
      }
    };

    for (const strike of strikes) {
      // Fundamental + softer harmonic makes the bell easier to hear on laptop/phone speakers.
      [
        { frequency: strike.frequency, level: 0.55 },
        { frequency: strike.frequency * 2, level: 0.20 },
      ].forEach(({ frequency, level }) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + strike.at;
        const end = start + 0.42;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(master);

        oscillator.onended = () => {
          try { oscillator.disconnect(); } catch {}
          try { gain.disconnect(); } catch {}
          cleanup();
        };

        oscillator.start(start);
        oscillator.stop(end + 0.02);
      });
    }

    return true;
  }

  dispose(): void {
    this.disposed = true;
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
