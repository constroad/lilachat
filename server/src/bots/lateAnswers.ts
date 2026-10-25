import type { CommandOutcome } from '@lilachat/shared';

/**
 * What the request of a sent form can still carry back: the answer the app gives LATER through
 * `/respond`, or its refusal (the form's errors).
 *
 * Why: the app answers «later» and its `/respond` may land before the acknowledgement of the
 * webhook comes back (agentes, 25/10/2026: the late answer at 22.698, the acknowledgement at
 * 22.807). Told only by the socket, a client that missed that one notice kept «Enviando…» for 30
 * s and then said «No se pudo confirmar» about a signing that WAS recorded. The request that is
 * still open is the one place that cannot be missed.
 */
export type LateAnswer = CommandOutcome | { status: 422; errors: Record<string, string> };

const DEFAULT_WAIT_MS = 8_000;
let waitMs = DEFAULT_WAIT_MS;
const waiting = new Map<string, (answer: LateAnswer | null) => void>();

/** Tests shorten the wait. */
export function configureLateAnswers(options: { waitMs?: number }): void {
  if (options.waitMs !== undefined) waitMs = options.waitMs;
}

export type LateAnswerWatch = {
  /** The answer if it comes within the wait (or came already), otherwise null. */
  within: () => Promise<LateAnswer | null>;
  /** Nobody waits for it anymore. */
  cancel: () => void;
};

/** Open BEFORE calling the app: its `/respond` can arrive before the webhook returns. */
export function expectLateAnswer(commandId: string): LateAnswerWatch {
  let settle: (answer: LateAnswer | null) => void = () => undefined;
  const settled = new Promise<LateAnswer | null>((resolve) => {
    settle = resolve;
  });
  waiting.set(commandId, settle);
  const forget = () => {
    if (waiting.get(commandId) === settle) waiting.delete(commandId);
  };
  return {
    within: () => {
      const timer = setTimeout(() => settle(null), waitMs);
      return settled.finally(() => {
        clearTimeout(timer);
        forget();
      });
    },
    cancel: () => {
      forget();
      settle(null);
    },
  };
}

/** The app's `/respond` landed: whoever still waits for it gets it. */
export function settleLateAnswer(commandId: string, answer: LateAnswer): void {
  waiting.get(commandId)?.(answer);
}
