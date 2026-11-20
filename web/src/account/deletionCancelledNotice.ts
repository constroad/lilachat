import { useEffect } from 'react';
import { ACCOUNT_DELETION_TEXTS } from '@lilachat/shared';

/**
 * A sign-in inside the 30 days cancels «Borrar mi cuenta» (`authRoutes.ts`); the
 * screen after it tells the person, once. Session storage: it only has to
 * survive the step from the sign-in to the shell.
 */
const KEY = 'lilachat:deletion-cancelled';

export function rememberIfDeletionCancelled(signIn: { accountDeletionCancelled?: boolean }): void {
  if (!signIn.accountDeletionCancelled) return;
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Without storage the notice is lost; the account is back all the same.
  }
}

export function takeDeletionCancelled(): boolean {
  try {
    const told = sessionStorage.getItem(KEY) === '1';
    sessionStorage.removeItem(KEY);
    return told;
  } catch {
    return false;
  }
}

/** The shell after the sign-in: «Se canceló el borrado…» once, in its own notice. */
export function useDeletionCancelledNotice(onNotice: (text: string) => void): void {
  useEffect(() => {
    if (takeDeletionCancelled()) onNotice(`${ACCOUNT_DELETION_TEXTS.cancelledTitle}. ${ACCOUNT_DELETION_TEXTS.cancelledBody}`);
  }, [onNotice]);
}

const DEADLINE_KEY = 'lilachat:deletion-deadline';

/** Asked from the settings panel: the page `/borrar-cuenta` opens on «Tu cuenta se cerró…» after the sign-out. */
export function rememberDeletionDeadline(deadline: Date): void {
  try {
    sessionStorage.setItem(DEADLINE_KEY, deadline.toISOString());
  } catch {
    // Without storage the page opens at its start; the account is closed all the same.
  }
}

export function takeDeletionDeadline(): Date | null {
  try {
    const stored = sessionStorage.getItem(DEADLINE_KEY);
    sessionStorage.removeItem(DEADLINE_KEY);
    const deadline = stored ? new Date(stored) : null;
    return deadline && !Number.isNaN(deadline.getTime()) ? deadline : null;
  } catch {
    return null;
  }
}
