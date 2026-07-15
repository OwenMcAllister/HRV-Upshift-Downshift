export interface TransitionMarker {
  timestamp: number;
  rmssd: number;
}

export class AutonomicEngine {
  private rrWindow: number[] = [];
  private maxWindowSize: number;
  private lastTransition: TransitionMarker | null = null;

  /**
   * @param windowSize Number of heartbeats to keep in the rolling window.
   * A size of 30 beats balances responsiveness with statistical stability.
   */
  constructor(windowSize: number = 30) {
    this.maxWindowSize = windowSize;
  }

  /**
   * Adds a raw RR-interval to the rolling window with artifact filtering.
   * @param rrMs Raw pulse-to-pulse interval in milliseconds.
   * @returns The updated RMSSD score, or null if the window doesn't have enough data.
   */
  public addBeat(rrMs: number): number | null {
    // 1. Out-of-bounds filter (Physiological limits: 300ms = 200bpm, 2000ms = 30bpm)
    if (rrMs < 300 || rrMs > 2000) {
      return this.getLatestRMSSD();
    }

    // 2. Motion Artifact / Ectopic Beat Filtering
    // Reject interval if it deviates by more than 30% from the immediate previous valid beat
    if (this.rrWindow.length > 0) {
      const lastValidBeat = this.rrWindow[this.rrWindow.length - 1];
      const variance = Math.abs(rrMs - lastValidBeat) / lastValidBeat;
      if (variance > 0.75) {
        return this.getLatestRMSSD();
      }
    }

    // 3. Append to rolling window
    this.rrWindow.push(rrMs);
    if (this.rrWindow.length > this.maxWindowSize) {
      this.rrWindow.shift();
    }

    return this.calculateRMSSD();
  }

  /**
   * Internal RMSSD calculator using the root mean square of successive differences formula.
   */
  private calculateRMSSD(): number | null {
    // Require a minimum of 5 beats to establish a meaningful variance
    if (this.rrWindow.length < 5) {
      return null;
    }

    let sumSquaredDifferences = 0;
    const segments = this.rrWindow.length - 1;

    for (let i = 0; i < segments; i++) {
      const difference = this.rrWindow[i + 1] - this.rrWindow[i];
      sumSquaredDifferences += difference * difference;
    }

    const meanSquaredDifference = sumSquaredDifferences / segments;
    return Math.sqrt(meanSquaredDifference);
  }

  /**
   * Helper to fetch the current score without appending a new beat.
   */
  private getLatestRMSSD(): number | null {
    return this.calculateRMSSD();
  }

  /**
   * Establishes a baseline marker the exact millisecond a user shifts states
   * (e.g., stopping a high-focus interval and starting resonance breathing).
   * @param currentRMSSD The baseline RMSSD score at the moment of transition.
   */
  public logStateTransition(currentRMSSD: number): void {
    this.lastTransition = {
      timestamp: Date.now(),
      rmssd: currentRMSSD,
    };
  }

  /**
   * Calculates the directional acceleration or deceleration of the autonomic nervous system.
   * @param currentRMSSD The current rolling RMSSD value.
   * @returns The rate of change in milliseconds of variance per second ($\Delta\text{RMSSD}/\Delta t$).
   * Positive value = Parasympathetic downshift (recovery).
   * Negative value = Sympathetic upshift (exertion/focus).
   */
  public calculateTransitionVelocity(currentRMSSD: number): number {
    if (!this.lastTransition) {
      return 0;
    }

    const timeDeltaSeconds = (Date.now() - this.lastTransition.timestamp) / 1000;

    // Prevent division by zero or extreme volatility in the first 3 seconds of a state swap
    if (timeDeltaSeconds < 3) {
      return 0;
    }

    const rmssdDelta = currentRMSSD - this.lastTransition.rmssd;
    return rmssdDelta / timeDeltaSeconds;
  }

  /**
   * Clears out current caches for clean state execution between different testing runs.
   */
  public reset(): void {
    this.rrWindow = [];
    this.lastTransition = null;
  }
}