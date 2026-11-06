/** What became of one send to FCM. */
export type PushOutcome = 'accepted' | 'dead' | 'failed';

const TALLY_WINDOW_MS = 3_600_000;

/**
 * A 404 is a dead token only when FCM says UNREGISTERED: the same status with a
 * wrong project id would otherwise wipe every token in the base.
 */
export function outcomeOfReply(status: number, body: string): PushOutcome {
  if (status >= 200 && status < 300) return 'accepted';
  return status === 404 && body.includes('UNREGISTERED') ? 'dead' : 'failed';
}

/**
 * One line an hour with what FCM answered. The phone went mute and the log had
 * nothing to say (José 05/11); a line per send would fill a log nobody rotates.
 */
export function createPushTally(write: (line: string) => void, now: () => number = Date.now): (outcome: PushOutcome) => void {
  let since = now();
  let counts: Record<PushOutcome, number> = { accepted: 0, dead: 0, failed: 0 };
  return (outcome) => {
    counts[outcome] += 1;
    if (now() - since < TALLY_WINDOW_MS) return;
    write(`[push] FCM en la última hora: ${counts.accepted} aceptados, ${counts.dead} vencidos, ${counts.failed} con error`);
    since = now();
    counts = { accepted: 0, dead: 0, failed: 0 };
  };
}
