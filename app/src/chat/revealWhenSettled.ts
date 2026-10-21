/** Quiet time of the content height before the list is shown (FlashList measures the rows above in a few frames). */
export const SETTLE_MS = 120;
/** It never stays blank longer than this, even if the height keeps changing. */
export const MAX_HIDDEN_MS = 900;

/**
 * When to show the conversation on entering (José, 21/10: «el salto al abrir
 * los chats»): after the list's first layout AND once its content height has
 * stopped changing, so the position correction never happens on screen.
 */
export class RevealWhenSettled {
  private loadedAt: number | null = null;
  private lastChangeAt: number | null = null;
  private height = -1;

  constructor(private readonly startedAt: number) {}

  load(now: number): void {
    this.loadedAt = now;
    this.lastChangeAt ??= now;
  }

  size(height: number, now: number): void {
    if (height === this.height) return;
    this.height = height;
    this.lastChangeAt = now;
  }

  check(now: number): 'wait' | 'reveal' {
    if (now - this.startedAt >= MAX_HIDDEN_MS) return 'reveal';
    if (this.loadedAt === null || this.lastChangeAt === null) return 'wait';
    return now - this.lastChangeAt >= SETTLE_MS ? 'reveal' : 'wait';
  }
}
