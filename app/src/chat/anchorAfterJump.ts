/**
 * A jump to a message keeps that message in place for a moment (B4 E2E, 28/10/2026):
 * right after a cold start the rows above it are still being measured (names, avatars
 * and the bot's rich cards resolve late), and the list moved away from the message two
 * seconds after showing it. Pure: the screen asks where to put the list back.
 */

/** How long a jump holds its message while the rows around it settle. A drag lets go sooner. */
export const ANCHOR_MS = 6_000;

export type JumpAnchor = { seq: number; until: number };

export function anchorFor(seq: number, now: number): JumpAnchor {
  return { seq, until: now + ANCHOR_MS };
}

/** The target's index in the CURRENT rows while the anchor lasts; `null` once it ended or the row is gone. */
export function anchoredIndex(anchor: JumpAnchor | null, now: number, indexOf: (seq: number) => number): number | null {
  if (!anchor || now > anchor.until) return null;
  const index = indexOf(anchor.seq);
  return index >= 0 ? index : null;
}
