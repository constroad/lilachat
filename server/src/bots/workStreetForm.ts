import type { AppForm, FormSchema } from '@lilachat/shared';

/**
 * Portal's `guardar_calle_de_obra` from the map (design o-02, José 07/11: everyone creates and
 * updates). Like the progress, it opens as a form with the street as context and nothing to
 * fill: the service is the door's, and Portal measures the line again. A new street carries the
 * phone's entry, so a resend after a lost answer does not draw it twice.
 */
export const WORK_STREET_TOOL = 'guardar_calle_de_obra';
/** Logical: an admin brings it back with `restaurar_de_obra` (José 07/11). */
export const WORK_STREET_DELETE_TOOL = 'borrar_calle_de_obra';
const NAME_MAX = 80;
const POINTS = { min: 2, max: 500 };
const WIDTH_MAX_M = 60;
const ID_MAX = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRM_ONLY: FormSchema = { type: 'object', properties: {} };

type LatLng = { lat: number; lng: number };
export type WorkStreetDeleteInput = { kind: 'work_street_delete'; streetId: string };
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

type Fields = { name: string | undefined; line: LatLng[] | undefined; widthM: number | undefined };

const streetIdOf = (raw: unknown): string => (typeof raw === 'string' && raw.trim().length <= ID_MAX ? raw.trim() : '');
const entryIdOf = (raw: unknown): string | null => (typeof raw === 'string' && UUID.test(raw) ? raw : null);

/** The three fields as sent; null when one of them came wrong. */
function fieldsOf(raw: Record<string, unknown>): Fields | null {
  const [name, line, widthM] = [nameOf(raw.name), lineOf(raw.line), widthOf(raw.width_m)];
  return name === null || line === null || widthM === null ? null : { name, line, widthM };
}

/** A new street needs name, line and entry; an edit, at least one change. */
const complete = (streetId: string, fields: Fields, entryId: string | null): boolean =>
  streetId ? Object.values(fields).some((value) => value !== undefined) : Boolean(fields.name && fields.line && entryId);

/** What the phone sends; anything off the contract is a 400. */
export function workStreetInputOf(raw: Record<string, unknown>): WorkStreetInput | null {
  const [streetId, fields, entryId] = [streetIdOf(raw.street_id), fieldsOf(raw), entryIdOf(raw.entry_id)];
  if (!fields || !complete(streetId, fields, entryId)) return null;
  return { kind: 'work_street', streetId: streetId || null, name: fields.name ?? null, line: fields.line ?? null, widthM: fields.widthM ?? null, entryId: streetId ? null : entryId };
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

/** «Borrar calle»: only the street, which Portal looks up in the door's service. */
export function workStreetDeleteInputOf(raw: Record<string, unknown>): WorkStreetDeleteInput | null {
  const streetId = streetIdOf(raw.street_id);
  return streetId ? { kind: 'work_street_delete', streetId } : null;
}

export const workStreetDeletePrepared = (serviceId: string, input: WorkStreetDeleteInput): { form: AppForm; context: StreetContext } => ({
  form: { id: WORK_STREET_DELETE_TOOL, title: 'Borrar calle', submitLabel: 'Borrar', schema: CONFIRM_ONLY },
  context: { servicioId: serviceId, calleId: input.streetId },
});
