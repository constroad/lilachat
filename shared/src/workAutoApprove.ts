import { resolvePendingProgress } from './workPending.js';
import type { WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * Field progress needs no approval (José 28/11: «ningún admin lo aprueba, simplemente que lo complete»).
 * Portal still creates every field record pending and only an admin may resolve it, so an admin's own
 * record is approved right after it is made with the existing `resolver_avance_de_obra`. A member's
 * stays pending in Portal (the map counts it anyway) until Portal records it approved.
 */
const RECORDING_KINDS = new Set<string>(['work_manual_progress']);
const ALREADY_MARKED = 'ya_marcada';

type Raw = Record<string, unknown>;
const objectOf = (raw: unknown): Raw => (raw && typeof raw === 'object' ? (raw as Raw) : {});

/** The record Portal just created; null for a refusal, a resend of one that existed, or no id. */
export function createdProgressIdOf(result: WorkProgressResult): string | null {
  if (!result.ok || !result.data) return null;
  const outer = objectOf(result.data);
  const raw = 'avanceId' in outer ? outer : objectOf(outer.data);
  return typeof raw.avanceId === 'string' && raw.avanceId && raw.code !== ALREADY_MARKED && raw.estado === 'pendiente' ? raw.avanceId : null;
}

/** Approves it through the map door; a refusal keeps the record and only logs why. */
async function approveRecorded(send: MapEditSend, result: WorkProgressResult): Promise<WorkProgressResult> {
  const id = createdProgressIdOf(result);
  if (!id) return result;
  try {
    const failure = await resolvePendingProgress(send, id, 'aprobar');
    if (failure) console.warn('work-map: auto approval refused', failure);
  } catch (error) {
    console.warn('work-map: auto approval failed', error instanceof Error ? error.message : error);
  }
  return result;
}

/** The admin's map door: every manual record it sends approves itself. */
export const approvingMapSend = (send: MapEditSend): MapEditSend => async (request, run) => {
  const result = await send(request, run);
  return RECORDING_KINDS.has(request.kind) ? approveRecorded(send, result) : result;
};

/** The admin's unit-suggested record (o-07) approves itself through the map door. */
export const approvingProgressSend = <E>(progress: (entry: E) => Promise<WorkProgressResult>, send: MapEditSend) =>
  async (entry: E): Promise<WorkProgressResult> => approveRecorded(send, await progress(entry));
