import type { FormField } from './appForms.js';

/** A one-line text allowed up to this many characters fits half a row: a plate, a lot. */
const SHORT_TEXT_MAX = 24;

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
      return !field.multiline && !field.digits && !field.secret;
    case 'date':
      return field.mode !== 'date-time';
    default:
      return true;
  }
}
