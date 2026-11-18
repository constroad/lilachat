import { FIELD_KEY, FIELD_VALUE_MAX, type ProspectField } from './prospectInsight.js';

/**
 * Fase 3 of the client's documents (José 17/11): Dali reads a metrado from a KML, a photo or a PDF and the field
 * comes «por confirmar». A seller confirms it as it is or writes the right value; agentes hears it
 * (`prospect.field.confirmed`) and its next PUT does not undo it.
 */
export type FieldConfirmation = { version: number; key: string; value?: string };

type Refusal = { ok: false; message: string };
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** The ficha's «Confirmar» (no value) or «Corregir» (the right value), with the `version` the seller saw. */
export function validateFieldConfirmation(raw: unknown): { ok: true; confirmation: FieldConfirmation } | Refusal {
  const body = record(raw);
  if (typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < 0) return { ok: false, message: 'version va como el número que viste, desde 0.' };
  if (typeof body.key !== 'string' || !FIELD_KEY.test(body.key)) return { ok: false, message: 'key es la clave del dato (minúsculas).' };
  if (body.value === undefined) return { ok: true, confirmation: { version: body.version, key: body.key } };
  const value = typeof body.value === 'string' ? body.value.trim() : '';
  if (!value || value.length > FIELD_VALUE_MAX) return { ok: false, message: `El valor corregido va escrito, hasta ${FIELD_VALUE_MAX} caracteres.` };
  return { ok: true, confirmation: { version: body.version, key: body.key, value } };
}

/** Dali's PUT replaces the fields; one a person confirmed stays as they left it unless Dali sends it confirmed too. */
export function keepConfirmedFields(incoming: readonly ProspectField[], stored: readonly ProspectField[] | undefined): ProspectField[] {
  const confirmedByPeople = new Map((stored ?? []).filter((field) => field.confirmedBy).map((field) => [field.key, field]));
  return incoming.map((field) => (field.confirmed ? field : confirmedByPeople.get(field.key) ?? field));
}
