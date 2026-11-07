import type { AppForm } from '@lilachat/shared';
import { stretchInputOf, WORK_PROGRESS_FORM, type ProgressStretch } from './workProgressForm.js';

/**
 * Portal's `registrar_avance_manual_de_obra` from the map (design o-06, Portal 57f06ec7): a stretch
 * done without trucks. No units to check, so nothing is asked of Portal before opening it: the
 * service is the door's, and Portal checks the street, the work and that each photo is a file of
 * this service's Drive. The form only asks for the note.
 */
export const MANUAL_PROGRESS_TOOL = 'registrar_avance_manual_de_obra';
const PHOTOS_MAX = 6;
const MEDIA_ID = /^[0-9a-f]{24}$/i;

export type WorkManualProgressInput = ProgressStretch & { kind: 'work_manual_progress'; photoIds: string[] };

/** The Drive files sent with it: none is fine, a wrong one is a 400. */
function photoIdsOf(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > PHOTOS_MAX) return null;
  const ids = value.filter((one): one is string => typeof one === 'string' && MEDIA_ID.test(one));
  return ids.length === value.length ? [...new Set(ids)] : null;
}

/** What the phone sends to open it; anything off the contract is a 400. */
export function workManualProgressInputOf(raw: Record<string, unknown>): WorkManualProgressInput | null {
  const [stretch, photoIds] = [stretchInputOf(raw), photoIdsOf(raw.photo_ids)];
  return stretch && photoIds ? { kind: 'work_manual_progress', ...stretch, photoIds } : null;
}

export function workManualProgressPrepared(serviceId: string, input: WorkManualProgressInput): { form: AppForm; context: Record<string, string | number | string[]> } {
  return {
    form: { id: MANUAL_PROGRESS_TOOL, title: 'Registrar avance', submitLabel: 'Registrar', schema: WORK_PROGRESS_FORM },
    context: {
      servicioId: serviceId,
      calleId: input.streetId,
      ...input.work,
      desdeM: input.fromM,
      hastaM: input.toM,
      entradaId: input.entryId,
      horaDelEquipo: input.deviceAt,
      ...(input.photoIds.length ? { fotoIds: input.photoIds } : {}),
    },
  };
}
