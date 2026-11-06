import type { FormField, FormValues } from './appForms.js';

/** Every one-line text with a limit (José 06/11: two per row wherever it can be; Portal declares its report fields with 200). */
const SHORT_TEXT_MAX = 200;

/**
 * The rows a form is drawn in (José, 28/10: a field per row turned every form
 * into a long sheet). Two short fields in a row share it, in the schema's
 * order: a number, a day, an hour, a short text, or whatever the app marks
 * `x-width: half`. Pass the fields SHOWN (`visibleFields`): a hidden one does
 * not keep its neighbours apart.
 */
export function formRows<F extends FormField>(fields: readonly F[]): F[][] {
  const rows: F[][] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    const next = fields[index + 1];
    if (next && fitsHalf(field) && fitsHalf(next)) {
      rows.push([field, next]);
      index += 1;
    } else rows.push([field]);
  }
  return rows;
}

/** The app's `x-width` when the field can take it; otherwise short typed values are half. */
function fitsHalf(field: FormField): boolean {
  if (!canBeHalf(field)) return false;
  if (field.width) return field.width === 'half';
  return field.kind === 'number' || field.kind === 'date' || (field.kind === 'text' && (field.maxLength ?? Infinity) <= SHORT_TEXT_MAX);
}

/** What needs the whole row whatever the app says: a list, a map, a photo (a signing's live selfie too), a long text, a code, a day with its hour. */
function canBeHalf(field: FormField): boolean {
  switch (field.kind) {
    case 'list':
    case 'location':
    case 'photo':
      return false;
    case 'text':
      return !field.multiline && !field.digits && !field.secret && !field.place;
    case 'date':
      return field.mode !== 'date-time';
    default:
      return true;
  }
}

const isAnswered = (value: unknown): boolean => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);

/**
 * The photo a report's form opens straight at the camera for (José 06/11: tile,
 * camera, shutter): its only photo, when nothing else is still required. The
 * rest of the form waits after the shot. Pass the fields SHOWN.
 */
export function cameraFirstFieldOf(shown: readonly FormField[], values: FormValues): string | null {
  const photos = shown.filter((field) => field.kind === 'photo');
  const photo = photos[0];
  if (photos.length !== 1 || !photo || photo.multiple || isAnswered(values[photo.name])) return null;
  return shown.some((field) => field !== photo && field.required && !isAnswered(values[field.name])) ? null : photo.name;
}
