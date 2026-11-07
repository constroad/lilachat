import { Types } from 'mongoose';
import type { AppForm, FormSchema } from '@lilachat/shared';
import type { CommandError } from './botCommands.js';
import { clientServiceDetail } from './clientFiles.js';

/**
 * Portal's `registrar_avance_de_obra` from the map (design o-07, agentes 07/11). It has no
 * shortcut: Lilachat opens it like `subir_al_drive`, with the lists as context, so the form only
 * asks for the note. The service is the door's, never the phone's, and only units the service's
 * detail brought go: Portal checks them again against its orders.
 */
export const WORK_PROGRESS_TOOL = 'registrar_avance_de_obra';
const NOTE_MAX = 280;
const UNITS_MAX = 30;
const ID_MAX = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_PROGRESS_FORM: FormSchema = { type: 'object', properties: { nota: { type: 'string', title: 'Nota del avance', maxLength: NOTE_MAX } } };
const UNITS_GONE = 'Esas unidades no salen en el detalle del servicio. Abre el mapa de nuevo.';

export type WorkProgressInput = {
  kind: 'work_progress';
  streetId: string;
  work: { etiquetaId: string } | { partidaId: string };
  fromM: number;
  toM: number;
  dispatchIds: string[];
  entryId: string;
  deviceAt: string;
};

const idOf = (value: unknown): string => (typeof value === 'string' && value.trim().length <= ID_MAX ? value.trim() : '');
const meters = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);

/** Exactly one of a tag or a contracted item, as Portal's schema asks. */
function workOf(raw: Record<string, unknown>): WorkProgressInput['work'] | null {
  const [tagId, partidaId] = [idOf(raw.tag_id), idOf(raw.partida_id)];
  if (Boolean(tagId) === Boolean(partidaId)) return null;
  return tagId ? { etiquetaId: tagId } : { partidaId };
}

function dispatchIdsOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > UNITS_MAX) return null;
  const ids = value.map(idOf);
  return ids.every(Boolean) ? [...new Set(ids)] : null;
}

/** What the phone sends to open the progress; anything off the contract is a 400. */
export function workProgressInputOf(raw: Record<string, unknown>): WorkProgressInput | null {
  const [streetId, work, fromM, toM, dispatchIds] = [idOf(raw.street_id), workOf(raw), meters(raw.from_m), meters(raw.to_m), dispatchIdsOf(raw.dispatch_ids)];
  const entryId = typeof raw.entry_id === 'string' && UUID.test(raw.entry_id) ? raw.entry_id : '';
  const deviceAt = typeof raw.device_at === 'string' && !Number.isNaN(Date.parse(raw.device_at)) ? raw.device_at : '';
  if (!streetId || !work || fromM === null || toM === null || toM <= fromM || !dispatchIds || !entryId || !deviceAt) return null;
  return { kind: 'work_progress', streetId, work, fromM, toM, dispatchIds, entryId, deviceAt };
}

/** The form and its context, with the units narrowed to those the service's detail brings. */
export async function workProgressPrepared(workspaceId: string, clientId: string, serviceId: string, userId: Types.ObjectId, input: WorkProgressInput): Promise<{ form: AppForm; context: Record<string, string | number | string[]> } | CommandError> {
  const detail = await clientServiceDetail(workspaceId, clientId, serviceId, userId);
  if (!('ok' in detail) || !detail.ok) return { status: 409, error: 'detail_failed', message: 'No se pudo comprobar el servicio. Prueba de nuevo.' };
  const known = new Set((detail.value.discharges ?? []).map((unit) => unit.dispatchId));
  const dispatchIds = input.dispatchIds.filter((id) => known.has(id));
  if (!dispatchIds.length) return { status: 409, error: 'units_not_in_service', message: UNITS_GONE };
  return {
    form: { id: WORK_PROGRESS_TOOL, title: 'Registrar avance', submitLabel: 'Registrar', schema: WORK_PROGRESS_FORM },
    context: { servicioId: serviceId, calleId: input.streetId, ...input.work, desdeM: input.fromM, hastaM: input.toM, despachoIds: dispatchIds, entradaId: input.entryId, horaDelEquipo: input.deviceAt },
  };
}
