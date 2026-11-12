import { gpsLine } from './observations.js';

/**
 * The additional area measured in the field (José 12/11, option B). An iPhone
 * has no APK, so it measures with Apple's «Medición» app and types the figures
 * here; Lilachat computes the area and guides each step, including how to come
 * back. Apple says the app works best on well-defined objects 0.5 to 3 meters
 * away, and that its figures are approximate. The limits are Portal's (its 68
 * real areas), so both sides refuse the same numbers.
 */

export type MeasureStep = { title: string; detail: string };

/** What the person reads before leaving Lilachat (Apple's Latin American guide for iOS 27). */
export const IPHONE_MEASURE_STEPS: readonly MeasureStep[] = [
  { title: 'Abre la app Medición', detail: 'Está en la carpeta Utilidades. También puedes deslizar hacia abajo en la pantalla de inicio y escribir «Medición».' },
  { title: 'Apunta al piso y mueve el iPhone despacio', detail: 'Espera a que aparezca el punto blanco al centro. Mantén el teléfono a la altura del pecho: Apple recomienda medir entre 0,5 y 3 metros del iPhone.' },
  { title: 'Mide el largo', detail: 'Pon el punto en una esquina del área y toca +. Camina despacio por el borde hasta la otra esquina y toca + otra vez.' },
  { title: 'Mide el ancho', detail: 'Desde la misma esquina, haz lo mismo por el lado corto. Si el área no es un rectángulo, divídela en rectángulos y registra cada uno.' },
  { title: 'Toma la foto de la medición', detail: 'Con las dos medidas en pantalla, toca el botón blanco redondo. Si no la encuentras en Fotos, haz una captura: botón lateral y subir volumen a la vez.' },
  { title: 'Vuelve a Lilachat', detail: 'Desliza hacia arriba desde el borde inferior y elige Lilachat. Lo que ya escribiste sigue aquí. Si Lilachat se abre desde el inicio, entra al canal del cliente, Servicios, el servicio, Informes y Área adicional: tu medida te espera.' },
  { title: 'Escribe el largo y el ancho', detail: 'Lilachat calcula el área. Adjunta la foto desde Fotos y toca Guardar área.' },
];

/** How an area was measured (Portal's `metodo`); `verificar` is Portal's office mark. */
export type AreaMethod = 'medidas-iphone' | 'a-mano' | 'ar-app' | 'foto-medida';
export const AREA_METHOD_LABELS: Record<AreaMethod, string> = { 'medidas-iphone': 'Medidas (iPhone)', 'a-mano': 'A mano', 'ar-app': 'AR (app)', 'foto-medida': 'Medida en foto' };
/** AR in the APK is for later (Portal 12/11): an iPhone uses Medición, the rest types it. */
export const measureMethodFor = (iphone: boolean): AreaMethod => (iphone ? 'medidas-iphone' : 'a-mano');

/** Portal's `OBSERVATION_APPROXIMATE_FROM_M`: past this, a place is approximate. */
export const APPROXIMATE_FROM_M = 15;
export const isApproximatePlace = (precisionM: number | undefined): boolean => precisionM !== undefined && precisionM > APPROXIMATE_FROM_M;
/** What the person sees while measuring: «GPS ±6 m», or «Ubicación aproximada (±22 m)» past 15 m. */
export const fieldPlaceLine = (precisionM: number | undefined): string => (isApproximatePlace(precisionM) ? `Ubicación aproximada (±${Math.round(precisionM!)} m)` : gpsLine(precisionM));

const CENTI = 100;
const SIDE_M = { min: 0.1, max: 500 };
const AREA_M2 = { min: 0.05, max: 5000, sure: 1000 };
const THICKNESS_CM = { min: 1, max: 50 };
const NUMBER = '(\\d+(?:[.,]\\d+)?)';
const LENGTH = new RegExp(`^${NUMBER}\\s*(m|cm)?$`, 'i');
const SQUARE = new RegExp(`^${NUMBER}\\s*(m2|m²)?$`, 'i');
const CENTIMETERS = new RegExp(`^${NUMBER}\\s*(cm)?$`, 'i');

const numberOf = (text: string) => Number(text.replace(',', '.'));
const within = (value: number, range: { min: number; max: number }) => (value >= range.min && value <= range.max ? value : null);
const rounded = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/** A side: «3,25», «3.25 m» or «325 cm», 0,1 to 500 m. */
export function parseLength(typed: string): number | null {
  const match = LENGTH.exec(typed.trim());
  if (!match) return null;
  const value = numberOf(match[1]!);
  return within(match[2]?.toLowerCase() === 'cm' ? value / CENTI : value, SIDE_M);
}

/** An area typed straight from Medición: «17,6» or «17,6 m²», 0,05 to 5 000 m². */
export function parseArea(typed: string): number | null {
  const match = SQUARE.exec(typed.trim());
  return match ? within(numberOf(match[1]!), AREA_M2) : null;
}

/** The thickness: «5» or «7,5 cm», 1 to 50 cm. */
export function parseThickness(typed: string): number | null {
  const match = CENTIMETERS.exec(typed.trim());
  return match ? within(numberOf(match[1]!), THICKNESS_CM) : null;
}

/** «1 500,00»: comma for decimals, a space between thousands, as the rest of the app. */
const decimalLabel = (value: number, decimals = 2) => {
  const [whole, fraction] = value.toFixed(decimals).split('.');
  return `${whole!.replace(/\B(?=(\d{3})+$)/g, ' ')},${fraction}`;
};

export type AreaMode = 'sides' | 'direct';
export type AreaInput = { mode: AreaMode; length: string; width: string; area: string; thickness: string };
export type AreaFigures = { lengthM?: number; widthM?: number; areaM2: number; thicknessCm?: number; volumeM3?: number; line: string; large: boolean };

function measuredArea(input: AreaInput): Pick<AreaFigures, 'lengthM' | 'widthM' | 'areaM2'> | null {
  if (input.mode === 'direct') {
    const areaM2 = parseArea(input.area);
    return areaM2 === null ? null : { areaM2: rounded(areaM2, 2) };
  }
  const typedLength = parseLength(input.length);
  const typedWidth = parseLength(input.width);
  if (typedLength === null || typedWidth === null) return null;
  // The sides Portal stores (2 decimals) are the ones multiplied: the sheet and the area agree.
  const lengthM = rounded(typedLength, 2);
  const widthM = rounded(typedWidth, 2);
  const areaM2 = within(rounded(lengthM * widthM, 2), AREA_M2);
  return areaM2 === null ? null : { lengthM, widthM, areaM2 };
}

/** What Lilachat computes from what was typed; null until it reads. A thickness out of range is left out. */
export function areaFigures(input: AreaInput): AreaFigures | null {
  const measured = measuredArea(input);
  if (!measured) return null;
  const sides = measured.lengthM !== undefined && measured.widthM !== undefined ? `${decimalLabel(measured.lengthM)} m × ${decimalLabel(measured.widthM)} m = ` : '';
  const thicknessCm = parseThickness(input.thickness);
  const volume = thicknessCm === null ? {} : { thicknessCm: rounded(thicknessCm, 1), volumeM3: rounded((measured.areaM2 * thicknessCm) / CENTI, 3) };
  const tail = volume.volumeM3 === undefined ? '' : ` · ${decimalLabel(volume.volumeM3, 3)} m³`;
  return { ...measured, ...volume, line: `${sides}${decimalLabel(measured.areaM2)} m²${tail}`, large: measured.areaM2 > AREA_M2.sure };
}

export type AreaDraftPoint = { lat: number; lng: number; precision?: number };
/** What was typed before going to Medición: iOS may reload the app on the way back. */
export type AreaDraft = AreaInput & { entryId: string; place: string; note: string; point: AreaDraftPoint | null; savedAt: number };

/** A draft older than this belongs to another visit to the site. */
export const AREA_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const areaDraftKey = (serviceId: string) => `lilachat.area-draft.${serviceId}`;

const isRecord = (raw: unknown): raw is Record<string, unknown> => typeof raw === 'object' && raw !== null;
const textOf = (value: unknown) => (typeof value === 'string' ? value : '');

function pointOf(raw: unknown): AreaDraftPoint | null {
  if (!isRecord(raw) || typeof raw.lat !== 'number' || typeof raw.lng !== 'number') return null;
  return { lat: raw.lat, lng: raw.lng, ...(typeof raw.precision === 'number' ? { precision: raw.precision } : {}) };
}

/** The saved draft, if it has its key and is recent; a field it lacks starts empty. */
export function restoredAreaDraft(raw: unknown, now: number): AreaDraft | null {
  if (!isRecord(raw) || typeof raw.entryId !== 'string' || typeof raw.savedAt !== 'number') return null;
  if (now - raw.savedAt > AREA_DRAFT_MAX_AGE_MS) return null;
  return {
    entryId: raw.entryId,
    mode: raw.mode === 'direct' ? 'direct' : 'sides',
    length: textOf(raw.length),
    width: textOf(raw.width),
    area: textOf(raw.area),
    thickness: textOf(raw.thickness),
    place: textOf(raw.place),
    note: textOf(raw.note),
    point: pointOf(raw.point),
    savedAt: raw.savedAt,
  };
}
