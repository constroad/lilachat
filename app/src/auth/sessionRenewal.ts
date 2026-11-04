/** Half the life of the JWT (`SESSION_TTL` on the server, 24 h): a phone that comes back renews with time to spare. */
export const RENEW_AFTER_MS = 12 * 60 * 60 * 1000;
/** The pause between attempts: no signal, or a server that refuses the token it has just issued. */
export const RENEW_RETRY_MS = 30_000;

const SESSION_REJECTED = 'unauthorized';

export type RenewalResult<Session> = { ok: true; session: Session } | { ok: false; revoked: boolean };

type Timer = unknown;

type RenewerOptions<Session> = {
  /** `null` when there is no session to renew. */
  refresh: () => Promise<RenewalResult<Session> | null>;
  onRenewed: (session: Session) => void;
  onRevoked: () => void;
  now: () => number;
  setTimer: (run: () => void, ms: number) => Timer;
  clearTimer: (timer: Timer) => void;
};

export type SessionRenewer = {
  /** The boot refresh is on its way: a refusal until `bootFinished` is the stored token, and it is being replaced. */
  bootStarted: () => void;
  bootFinished: (renewed: boolean) => void;
  renewIfDue: () => void;
  renewRejected: () => void;
  /** Out of the foreground: no retries, and coming back picks up what was left. */
  pause: () => void;
  /** Signed out: an answer in the air must not bring the session back. */
  forget: () => void;
};

export function renewalDue(renewedAt: number | null, now: number): boolean {
  return renewedAt === null || now - renewedAt >= RENEW_AFTER_MS;
}

/** The reason of a `connect_error` that is about the session, and not about the network or an old build. */
export function rejectsSession(reason: string): boolean {
  return reason === SESSION_REJECTED;
}

function createRetryTimer({ setTimer, clearTimer }: Pick<RenewerOptions<unknown>, 'setTimer' | 'clearTimer'>) {
  let timer: Timer | null = null;
  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const schedule = (run: () => void, ms: number) => {
    cancel();
    timer = setTimer(() => {
      timer = null;
      run();
    }, ms);
  };
  return { cancel, schedule, pending: () => timer !== null };
}

/**
 * Keeps the JWT alive while the process lives. It was renewed only at boot, and a
 * server that refuses a handshake is not retried by socket.io: 27 h later the app
 * sat in «Conectando…» with a healthy server (04/11/2026).
 */
export function createSessionRenewer<Session>(options: RenewerOptions<Session>): SessionRenewer {
  let renewedAt: number | null = null;
  let attemptedAt: number | null = null;
  let booting = false;
  let inFlight = false;
  let rejected = false;
  let generation = 0;
  const retry = createRetryTimer(options);

  const settle = (result: RenewalResult<Session> | null) => {
    if (result && !result.ok && !result.revoked) {
      retry.schedule(attempt, RENEW_RETRY_MS);
      return;
    }
    rejected = false;
    if (result?.ok) {
      renewedAt = options.now();
      options.onRenewed(result.session);
    } else if (result) {
      options.onRevoked();
    }
  };

  const attempt = () => {
    if (inFlight || booting) return;
    const waited = attemptedAt === null ? RENEW_RETRY_MS : options.now() - attemptedAt;
    if (waited < RENEW_RETRY_MS) {
      if (!retry.pending()) retry.schedule(attempt, RENEW_RETRY_MS - waited);
      return;
    }
    retry.cancel();
    inFlight = true;
    attemptedAt = options.now();
    const startedIn = generation;
    options
      .refresh()
      .catch((): RenewalResult<Session> => ({ ok: false, revoked: false }))
      .then((result) => {
        if (startedIn !== generation) return;
        inFlight = false;
        settle(result);
      });
  };

  return {
    bootStarted: () => {
      booting = true;
    },
    bootFinished: (renewed) => {
      booting = false;
      if (renewed) {
        rejected = false;
        renewedAt = options.now();
        retry.cancel();
      } else if (rejected) {
        attempt();
      }
    },
    renewIfDue: () => {
      if (rejected || renewalDue(renewedAt, options.now())) attempt();
    },
    renewRejected: () => {
      rejected = true;
      attempt();
    },
    pause: retry.cancel,
    forget: () => {
      generation += 1;
      renewedAt = null;
      attemptedAt = null;
      booting = false;
      inFlight = false;
      rejected = false;
      retry.cancel();
    },
  };
}
