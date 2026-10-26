import type { ChatSummary } from '../api/client';
import { planOpening, type NoticeDestination, type OpeningPlan } from './destinoDeAviso';

/** What the lookup of a tap's chat found out: it is there, the server says it is not, or there was no answer. */
export type NoticeLookup = { kind: 'found'; chat: ChatSummary } | { kind: 'missing' } | { kind: 'failed' };

/** What happened to a tap, for the phone's diagnostics (no ids, no text: only how it went and how long it took). */
export type NoticeEvent =
  | { kind: 'lookup'; attempt: number; result: NoticeLookup['kind']; ms: number }
  | { kind: 'opened'; ms: number }
  | { kind: 'navigation-not-ready'; ms: number }
  | { kind: 'gave-up'; ms: number };

const LOOKUP_RESULT_CODE: Record<NoticeLookup['kind'], number> = { found: 0, missing: 1, failed: 2 };

/** The diagnostics entry of an event: `resultado` is 0 found, 1 missing, 2 no answer. */
export function perfOfNoticeEvent(event: NoticeEvent): { op: string; ms: number; extra?: Record<string, number> } {
  switch (event.kind) {
    case 'lookup':
      return { op: 'aviso-busqueda', ms: event.ms, extra: { intento: event.attempt, resultado: LOOKUP_RESULT_CODE[event.result] } };
    case 'opened':
      return { op: 'aviso-abierto', ms: event.ms };
    case 'navigation-not-ready':
      return { op: 'aviso-sin-navegacion', ms: event.ms };
    case 'gave-up':
      return { op: 'aviso-sin-respuesta', ms: event.ms };
  }
}

/** The wait before asking the navigation again when it was not ready to take the chat. */
export const NAVIGATION_WAIT_MS = 300;
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
      /** Whether the navigation took the chat: `false` while it is not ready, so the tap is not lost. */
      open: (plan: OpenPlan) => boolean;
      openAgenda: () => void;
      now: () => number;
      sleep: (ms: number) => Promise<void>;
      report: (event: NoticeEvent) => void;
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
      this.deps.report({ kind: 'lookup', attempt: attempt + 1, result: lookup.kind, ms: this.deps.now() - startedAt });
      if (lookup.kind === 'found') return this.openWhenReady(destination, lookup.chat, startedAt);
      const jwtChanged = this.jwt !== askedWith;
      if (lookup.kind === 'missing' && !jwtChanged) return;
      const wait = RETRY_DELAYS_MS[attempt];
      if (wait === undefined || this.deps.now() - startedAt > RETRY_WINDOW_MS) return this.deps.report({ kind: 'gave-up', ms: this.deps.now() - startedAt });
      if (!jwtChanged) await this.waitOrWake(wait);
    }
  }

  dispose(): void {
    this.alive = false;
    this.wake?.();
  }

  /** The chat is known: it opens as soon as the navigation can take it (at a cold start it may not be mounted yet). */
  private async openWhenReady(destination: NoticeDestination, chat: ChatSummary, startedAt: number): Promise<void> {
    const plan = planOpening(destination, chat);
    if (plan.action !== 'open') return;
    while (this.alive) {
      if (this.deps.open(plan)) return this.deps.report({ kind: 'opened', ms: this.deps.now() - startedAt });
      if (this.deps.now() - startedAt > RETRY_WINDOW_MS) return this.deps.report({ kind: 'navigation-not-ready', ms: this.deps.now() - startedAt });
      await this.waitOrWake(NAVIGATION_WAIT_MS);
    }
  }

  /** Waits, unless a new jwt (or the end of this opener) calls for the next try sooner. */
  private async waitOrWake(ms: number): Promise<void> {
    await Promise.race([this.deps.sleep(ms), new Promise<void>((resolve) => (this.wake = resolve))]);
    this.wake = null;
  }
}
