import type { ChatSummary } from '../api/client';
import { planOpening, type NoticeDestination, type OpeningPlan } from './destinoDeAviso';

/** What the lookup of a tap's chat found out: it is there, the server says it is not, or there was no answer. */
export type NoticeLookup = { kind: 'found'; chat: ChatSummary } | { kind: 'missing' } | { kind: 'failed' };

/** The waits before each new try after a failed lookup. */
export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;
/** No new try starts once a tap is this old (a try itself can take as long as the request timeout). */
export const RETRY_WINDOW_MS = 45_000;

type OpenPlan = Extract<OpeningPlan, { action: 'open' }>;

/**
 * Opens what a tapped notice leads to. The tap is taken only once, so its lookup must
 * outlive a bad moment (B4 E2E, 25/10): the host answered one request in three, and
 * a cold start refreshes the jwt behind the first screen, so the single lookup failed
 * and the tap did nothing. A failed lookup is asked again after a wait (a fresh jwt
 * is tried at once); only an answer from the server that the chat is not there ends it.
 */
export class NoticeOpener {
  private alive = true;
  private wake: (() => void) | null = null;

  constructor(
    private readonly deps: {
      find: (destination: NoticeDestination, jwt: string) => Promise<NoticeLookup>;
      open: (plan: OpenPlan) => void;
      openAgenda: () => void;
      now: () => number;
      sleep: (ms: number) => Promise<void>;
    },
    private jwt: string
  ) {}

  /** The latest jwt: a wait in progress ends so the tap is tried with it right away. */
  setJwt(jwt: string): void {
    if (jwt === this.jwt) return;
    this.jwt = jwt;
    this.wake?.();
  }

  async handle(destination: NoticeDestination): Promise<void> {
    if (!this.alive) return;
    if (destination.tipo === 'agenda') return this.deps.openAgenda();
    const startedAt = this.deps.now();
    for (let attempt = 0; this.alive; attempt += 1) {
      const askedWith = this.jwt;
      const lookup = await this.deps.find(destination, askedWith);
      if (!this.alive) return;
      if (lookup.kind === 'found') return this.openFound(destination, lookup.chat);
      const jwtChanged = this.jwt !== askedWith;
      if (lookup.kind === 'missing' && !jwtChanged) return;
      const wait = RETRY_DELAYS_MS[attempt];
      if (wait === undefined || this.deps.now() - startedAt > RETRY_WINDOW_MS) return;
      if (!jwtChanged) await this.waitOrWake(wait);
    }
  }

  dispose(): void {
    this.alive = false;
    this.wake?.();
  }

  private openFound(destination: NoticeDestination, chat: ChatSummary): void {
    const plan = planOpening(destination, chat);
    if (plan.action === 'open') this.deps.open(plan);
  }

  /** Waits, unless a new jwt (or the end of this opener) calls for the next try sooner. */
  private async waitOrWake(ms: number): Promise<void> {
    await Promise.race([this.deps.sleep(ms), new Promise<void>((resolve) => (this.wake = resolve))]);
    this.wake = null;
  }
}
