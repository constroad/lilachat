import type { AppForm, FormSchema } from '@lilachat/shared';

/**
 * Portal's `marcar_foto_antes_despues` (2ef27173, approved by José 08/11 for any member of the
 * channel): a photo of the service marked «antes» or «después», or unmarked with `null`. Nothing to
 * fill: the photo, the phase and the stretch ride as context, and the service is the door's.
 */
export const PHOTO_PHASE_TOOL = 'marcar_foto_antes_despues';
const PHOTO_ID_MAX = 64;
const STRETCH_MAX = 80;
const CONFIRM_ONLY: FormSchema = { type: 'object', properties: {} };

export type PhotoPhaseInput = { kind: 'photo_phase'; photoId: string; phase: 'antes' | 'despues' | null; stretch: string | null };
export type PhotoPhaseContext = Record<string, string | null>;

const phaseOf = (raw: unknown): PhotoPhaseInput['phase'] | undefined => (raw === 'antes' || raw === 'despues' || raw === null ? raw : undefined);

/** undefined: the photo keeps its stretch; null: sent wrong. */
function stretchOf(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  const stretch = typeof raw === 'string' ? raw.trim() : '';
  return stretch && stretch.length <= STRETCH_MAX ? stretch : null;
}

/** What the phone sends; anything off the contract is a 400. */
export function photoPhaseInputOf(raw: Record<string, unknown>): PhotoPhaseInput | null {
  const photoId = typeof raw.photo_id === 'string' ? raw.photo_id.trim() : '';
  const [phase, stretch] = [phaseOf(raw.phase), stretchOf(raw.stretch)];
  if (!photoId || photoId.length > PHOTO_ID_MAX || phase === undefined || stretch === null) return null;
  return { kind: 'photo_phase', photoId, phase, stretch: stretch ?? null };
}

export const photoPhasePrepared = (serviceId: string, input: PhotoPhaseInput): { form: AppForm; context: PhotoPhaseContext } => ({
  form: { id: PHOTO_PHASE_TOOL, title: 'Antes y después', submitLabel: 'Marcar', schema: CONFIRM_ONLY },
  context: { servicioId: serviceId, fotoId: input.photoId, fase: input.phase, ...(input.stretch ? { tramo: input.stretch } : {}) },
});
