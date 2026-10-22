type Releasable = { pause: () => void; clearLockScreenControls: () => void; remove: () => void };

/**
 * Stops and lets go of a voice note's player (José, 22/10: closing its card
 * left the audio playing). `remove()` alone releases the object, not the
 * sound: it is paused first. Each step runs even if an earlier one failed.
 */
export function releasePlayer(player: Releasable, report: (error: unknown) => void): void {
  for (const step of [() => player.pause(), () => player.clearLockScreenControls(), () => player.remove()]) {
    try {
      step();
    } catch (error) {
      report(error);
    }
  }
}
