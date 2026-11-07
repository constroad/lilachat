import type { AppForm, FormSchema } from '@lilachat/shared';

/**
 * Portal's `guardar_calle_de_obra` from the map (design o-02, José 07/11: «todos pueden crear y
 * actualizar»). Like the progress, it opens as a form with the street as context and nothing to
 * fill: the service is the door's, and Portal measures the line again. A new street carries the
 * phone's entry, so a resend after a lost answer does not draw it twice.
 */
export const WORK_STREET_TOOL = 'guardar_calle_de_obra';
const NAME_MAX = 80;
const POINTS = { min: 2, max: 500 };
const WIDTH_MAX_M = 60;
const ID_MAX = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRM_ONLY: FormSchema = { type: 'object', properties: {} };

type LatLng = { lat: number; lng: number };
export type WorkStreetInput = { kind: 'work_street'; streetId: string | null; name: string | null; line: LatLng[] | null; widthM: number | null; entryId: string | null };
export type StreetContext = Record<string, string | number | LatLng[]>;

const pointOf = (raw: unknown): LatLng | null => {
  const { lat, lng } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const inRange = typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return inRange ? { lat, lng } : null;
};

/** undefined: not sent; null: sent wrong. */
function lineOf(raw: unknown): LatLng[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length < POINTS.min || raw.length > POINTS.max) return null;
  const points = raw.map(pointOf);
  return points.every((point): point is LatLng => point !== null) ? points : null;
}

const nameOf = (raw: unknown): string | null | undefined => {
  if (raw === undefined) return undefined;
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name && name.length <= NAME_MAX ? name : null;
};

const widthOf = (raw: unknown): number | null | undefined => {
  if (raw === undefined) return undefined;
  return typeof raw === 'number' && raw > 0 && raw <= WIDTH_MAX_M ? raw : null;
};

/** What the phone sends; a new street needs name, line and entry, an edit at least one change. */
export function workStreetInputOf(raw: Record<string, unknown>): WorkStreetInput | null {
  const streetId = typeof raw.street_id === 'string' && raw.street_id.trim().length <= ID_MAX ? raw.street_id.trim() : '';
  const [name, line, widthM] = [nameOf(raw.name), lineOf(raw.line), widthOf(raw.width_m)];
  if (name === null || line === null || widthM === null) return null;
  const entryId = typeof raw.entry_id === 'string' && UUID.test(raw.entry_id) ? raw.entry_id : null;
  if (!streetId && (!name || !line || !entryId)) return null;
  if (streetId && name === undefined && line === undefined && widthM === undefined) return null;
  return { kind: 'work_street', streetId: streetId || null, name: name ?? null, line: line ?? null, widthM: widthM ?? null, entryId: streetId ? null : entryId };
}

export function workStreetPrepared(serviceId: string, input: WorkStreetInput): { form: AppForm; context: StreetContext } {
  const context: StreetContext = {
    servicioId: serviceId,
    ...(input.streetId ? { calleId: input.streetId } : {}),
    ...(input.name ? { nombre: input.name } : {}),
    ...(input.line ? { trazo: input.line } : {}),
    ...(input.widthM !== null ? { anchoM: input.widthM } : {}),
    ...(input.entryId ? { entradaId: input.entryId } : {}),
  };
  return { form: { id: WORK_STREET_TOOL, title: 'Guardar calle', submitLabel: 'Guardar', schema: CONFIRM_ONLY }, context };
}
