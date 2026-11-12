import { AREAS_OPEN_HERE, type AppForm, type AreaMethod, type FormSchema } from '@lilachat/shared';

/**
 * An additional area measured from the client's channel (José 12/11, option B;
 * Portal's proposed contract of the same day). It opens as a form of the app
 * whose two optional fields are the place and the description; the figures,
 * the method and the GPS ride as context, which lands in the tool's values.
 * Portal stores it `manual: true` and recomputes nothing over it.
 */
export const REGISTER_AREA_TOOL = 'registrar_area_adicional';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_MAX = 64;
const PLACE_MAX = 120;
const DESCRIPTION_MAX = 300;
const PRECISION_MAX_M = 5000;
/** Portal's limits from its 68 real areas; the field engine (`areaMeasure`) refuses the same numbers. */
const SIDE_M = { min: 0.1, max: 500 };
const AREA_M2 = { min: 0.05, max: 5000 };
const THICKNESS_CM = { min: 1, max: 50 };
/** The phone may round the area once more than its sides: a cent of slack. */
const PRODUCT_SLACK_M2 = 0.01;
/** What the field sends today: AR is for later, «Medida en foto» is Portal's own. */
const FIELD_METHODS: readonly AreaMethod[] = ['medidas-iphone', 'a-mano'];

export type AreaFormInput = {
  kind: 'area_create'; entryId: string; lengthM: number | null; widthM: number | null; areaM2: number; thicknessCm: number | null;
  method: AreaMethod; lat: number | null; lng: number | null; precisionM: number | null; source: 'apk' | 'web'; reportId: string | null;
};
export type AreaFormContext = Record<string, string | number>;

const FORM: FormSchema = {
  type: 'object',
  properties: {
    ubicacion: { type: 'string', title: 'Dónde está', maxLength: PLACE_MAX },
    descripcion: { type: 'string', title: 'Por qué es adicional', maxLength: DESCRIPTION_MAX },
  },
};

const inRange = (raw: unknown, range: { min: number; max: number }): number | null => (typeof raw === 'number' && Number.isFinite(raw) && raw >= range.min && raw <= range.max ? raw : null);
const coordinate = (raw: unknown, limit: number): number | null => (typeof raw === 'number' && Number.isFinite(raw) && Math.abs(raw) <= limit ? raw : null);
const idOf = (raw: unknown): string => (typeof raw === 'string' && raw.trim().length <= ID_MAX ? raw.trim() : '');

/** Off until Portal publishes its tools (`AREAS_OPEN_HERE`): the kind does not exist meanwhile. */
export const isAreaFormKind = (kind: unknown): kind is AreaFormInput['kind'] => AREAS_OPEN_HERE && kind === 'area_create';

/** Both sides or none; with both, the area is their product. */
function sidesOf(raw: Record<string, unknown>, areaM2: number): { lengthM: number | null; widthM: number | null } | null {
  if (raw.length_m === undefined && raw.width_m === undefined) return { lengthM: null, widthM: null };
  const [lengthM, widthM] = [inRange(raw.length_m, SIDE_M), inRange(raw.width_m, SIDE_M)];
  if (lengthM === null || widthM === null) return null;
  return Math.abs(lengthM * widthM - areaM2) <= PRODUCT_SLACK_M2 ? { lengthM, widthM } : null;
}

/** Both halves of the place or none. */
function placeOf(raw: Record<string, unknown>): { lat: number | null; lng: number | null } | null {
  if (raw.lat === undefined && raw.lng === undefined) return { lat: null, lng: null };
  const [lat, lng] = [coordinate(raw.lat, 90), coordinate(raw.lng, 180)];
  return lat === null || lng === null ? null : { lat, lng };
}

/** What the phone asked; anything off Portal's limits is a 400 before the door. */
export function areaFormInputOf(raw: Record<string, unknown>): AreaFormInput | null {
  const entryId = typeof raw.entry_id === 'string' && UUID.test(raw.entry_id) ? raw.entry_id : '';
  const areaM2 = inRange(raw.area_m2, AREA_M2);
  const method = FIELD_METHODS.find((one) => one === raw.method);
  if (!entryId || areaM2 === null || !method || (raw.source !== 'apk' && raw.source !== 'web')) return null;
  const sides = sidesOf(raw, areaM2);
  const place = placeOf(raw);
  const thicknessCm = raw.thickness_cm === undefined ? null : inRange(raw.thickness_cm, THICKNESS_CM);
  if (!sides || !place || (raw.thickness_cm !== undefined && thicknessCm === null)) return null;
  const precisionM = inRange(raw.precision_m, { min: 0, max: PRECISION_MAX_M });
  return { kind: 'area_create', entryId, ...sides, areaM2, thicknessCm, method, ...place, precisionM: place.lat === null ? null : precisionM, source: raw.source, reportId: idOf(raw.report_id) || null };
}

const some = (key: string, value: number | string | null): AreaFormContext => (value === null ? {} : { [key]: value });

export function areaFormPrepared(serviceId: string, input: AreaFormInput): { form: AppForm; context: AreaFormContext } {
  return {
    form: { id: REGISTER_AREA_TOOL, title: 'Nueva área', submitLabel: 'Guardar área', schema: FORM },
    context: {
      servicioId: serviceId, kind: 'crear', entradaId: input.entryId,
      ...some('largoM', input.lengthM), ...some('anchoM', input.widthM), areaM2: input.areaM2, ...some('espesorCm', input.thicknessCm),
      metodo: input.method, ...some('lat', input.lat), ...some('lng', input.lng), ...some('precisionM', input.precisionM),
      fuente: input.source, ...some('informeId', input.reportId),
    },
  };
}
