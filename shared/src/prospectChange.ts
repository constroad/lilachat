import type { ProspectView } from './prospectBoard.js';
import type { LossReason, NextActionKind, ProspectOutcome } from './prospectSeller.js';

/** What a seller decides (BOTS-API «Fase 2: contrato»), as the PATCH takes it: the web and the APK send the same. */
export type SellerPatch = {
  assignee?: 'me' | { id: string } | null;
  next_action?: { kind: NextActionKind; at: string; assignee_id?: string; note?: string; remind: boolean } | null;
  result?: { outcome: ProspectOutcome; reason?: LossReason; note?: string } | null;
};

export type ChangeOutcome = { ok: true; prospect: ProspectView } | { ok: false; stale: boolean; message: string };

/** The server's answer to a seller's change, as the web's `api` and the APK's `jsonCall` return it. */
export type ChangeAnswer = { ok: true; data: { prospect: ProspectView } } | { ok: false; status?: number; message?: string };

const STALE_STATUS = 409;
export const STALE_MESSAGE = 'Alguien lo cambió antes que tú. Ya ves lo último: revísalo y vuelve a intentarlo.';
export const CHANGE_FAILED_MESSAGE = 'No se pudo guardar. Inténtalo de nuevo.';

/** Every change goes with the version the seller saw: a 409 means someone was first and nothing changed. */
export function changeOutcomeOf(answer: ChangeAnswer): ChangeOutcome {
  if (answer.ok) return { ok: true, prospect: answer.data.prospect };
  const stale = answer.status === STALE_STATUS;
  return { ok: false, stale, message: stale ? STALE_MESSAGE : answer.message || CHANGE_FAILED_MESSAGE };
}
