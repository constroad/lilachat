import type { ChatSummary } from '../api/client';
import { planOpening, type NoticeDestination, type OpeningPlan } from './destinoDeAviso';

/** How long a tap whose chat could not be found waits for a refreshed jwt before it is let go. */
export const RETRY_WINDOW_MS = 30_000;

type OpenPlan = Extract<OpeningPlan, { action: 'open' }>;

type Waiting = { destination: NoticeDestination; since: number };

/**
 * Opens what a tapped notice leads to. A cold start enters with the saved (often
 * stale) credential and refreshes it behind, so the first lookup can fail or the
 * jwt can change under it: the tap is taken only once, so it must outlive that
 * (B4 E2E case 3, 25/10: tapping a notice with the app closed did nothing).
 * A tap whose chat is not found waits a short while for the next jwt and tries
 * once more; after that, or when the chat truly does not exist, it is let go.
 */
export class NoticeOpener {
  private alive = true;
  private waiting: Waiting | null = null;

  constructor(
    private readonly deps: {
      find: (destination: NoticeDestination, jwt: string) => Promise<ChatSummary | null>;
      open: (plan: OpenPlan) => void;
      openAgenda: () => void;
      now: () => number;
    },
    private jwt: string
  ) {}

  /** The latest jwt: a tap waiting for it is tried again with it. */
  setJwt(jwt: string): void {
    if (jwt === this.jwt) return;
    this.jwt = jwt;
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting && this.deps.now() - waiting.since <= RETRY_WINDOW_MS) void this.handle(waiting.destination, true);
  }

  async handle(destination: NoticeDestination, retried = false): Promise<void> {
    if (!this.alive) return;
    if (destination.tipo === 'agenda') return this.deps.openAgenda();
    const askedWith = this.jwt;
    const plan = planOpening(destination, await this.deps.find(destination, askedWith));
    if (!this.alive) return;
    if (plan.action === 'open') {
      this.waiting = null;
      return this.deps.open(plan);
    }
    if (retried) return;
    // The jwt changed while asking: the answer was for the old one.
    if (this.jwt !== askedWith) return this.handle(destination, true);
    this.waiting = { destination, since: this.deps.now() };
  }

  dispose(): void {
    this.alive = false;
    this.waiting = null;
  }
}
