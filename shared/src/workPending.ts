import { FORMS_LEVEL } from './appForms.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * Portal's `resolver_avance_de_obra` (admins, a9b1c3ba). Since José 28/11 nobody approves field
 * progress by hand: it serves the admin's own record approving itself (`workAutoApprove.ts`) and an
 * admin's «Deshacer» (`rechazar`). PURE: the APK and the web send it through the door.
 */
export type PendingDecision = 'aprobar' | 'rechazar';
/** The server still opens `avances_pendientes_de_obra`; the map no longer asks it. */
export type WorkPendingRequest = { kind: 'work_pending'; forms: number };
export type WorkResolveRequest = { kind: 'work_resolve'; progress_id: string; decision: PendingDecision; note?: string; forms: number };

export const RESOLVED = 'Listo.';
export const RESOLVE_FAILED = 'No se pudo guardar. Revisa tu señal y vuelve a intentarlo.';

export function workResolveRequest(id: string, decision: PendingDecision, note?: string): WorkResolveRequest {
  const clean = note?.trim();
  return { kind: 'work_resolve', progress_id: id, decision, ...(clean ? { note: clean } : {}), forms: FORMS_LEVEL };
}

const sendWorkResolve = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: RESOLVED, failed: RESOLVE_FAILED });

/** Null when Portal kept it, else why not. */
export async function resolvePendingProgress(send: MapEditSend, id: string, decision: PendingDecision, note?: string): Promise<string | null> {
  const result = await send(workResolveRequest(id, decision, note), sendWorkResolve);
  return result.ok ? null : result.message;
}
