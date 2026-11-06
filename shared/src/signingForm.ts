import { isRecordId, liveSelfieFieldOf, type FormField, type FormValues, type GeoPoint } from './appForms.js';
import type { ChoiceOption } from './appFormOptions.js';
import { precisionLabel } from './appActions.js';

/**
 * The steps of a signing (José 06/11): first a card per employee, and the camera
 * only once a name is picked, like Portal's attendance page. PURE: the app and
 * the web draw with it.
 */
export const SIGNER_KICKER = '¿Quién firma?';

type ChoiceField = Extract<FormField, { kind: 'choice' }>;
export type SigningStep = 'who' | 'sign';

/** More than this and a choice no longer fits a line of chips. */
const CHIPS_MAX = 6;
const CHIP_LABEL_MAX = 12;
const PLAIN_WORD = /^\p{L}+$/u;
/** About a hundred meters: a GPS that refines reads as the same block. */
const PLACE_KEY_DECIMALS = 3;

const isChoice = (field: FormField): field is ChoiceField => field.kind === 'choice';

/** The list of people of a signing; `null` in any other form, and when the person signs for themselves. */
export function signerFieldOf(fields: readonly FormField[]): ChoiceField | null {
  if (!liveSelfieFieldOf(fields)) return null;
  return fields.filter(isChoice).find((field) => field.options.some((option) => isRecordId(option.value))) ?? null;
}

/** On the cards until a name is picked; the camera only turns on after. */
export function signingStepOf(fields: readonly FormField[], values: FormValues): SigningStep {
  const signer = signerFieldOf(fields);
  return signer && !values[signer.name] ? 'who' : 'sign';
}

/** A fixed choice of a signing goes as chips in one line. */
export function chipsFor(fields: readonly FormField[], field: FormField): boolean {
  if (!isChoice(field) || !liveSelfieFieldOf(fields)) return false;
  return field.name !== signerFieldOf(fields)?.name && field.options.length > 0 && field.options.length <= CHIPS_MAX;
}

/** A long label gives way to the option's own word: «Salida a refrigerio» is «Refrigerio», and the four fit. */
export function chipLabelOf(option: Pick<ChoiceOption, 'value' | 'label'>): string {
  if (option.label.length <= CHIP_LABEL_MAX || !PLAIN_WORD.test(option.value)) return option.label;
  return `${option.value.charAt(0).toUpperCase()}${option.value.slice(1)}`;
}

/** The block a reading falls in: the address is asked once per block. */
export const placeKeyOf = (point: Pick<GeoPoint, 'lat' | 'lng'>): string => `${point.lat.toFixed(PLACE_KEY_DECIMALS)},${point.lng.toFixed(PLACE_KEY_DECIMALS)}`;

/**
 * The line under a signing's camera: the address, never coordinates; those are
 * only the stamp's last resort. `undefined`: still asking; `null`: no address.
 */
export function signingPlaceLine(point: GeoPoint | null, place: string | null | undefined): string {
  if (!point) return 'Buscando tu ubicación…';
  const where = place ?? (place === null ? 'Ubicación lista' : 'Buscando la dirección…');
  return `${where} · ${precisionLabel(point)}`;
}
