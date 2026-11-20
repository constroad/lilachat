import type { FormField, FormValues } from './appForms.js';
import { isBlankAnswer } from './appFormSections.js';

/**
 * The trays of a CTL-IMP drawn as compact rows (design imp-01/imp-03, José 19/11): one row per
 * sample, its state beside it. The rule itself lives in `formSamples.ts`; this only reads it for
 * the screen. PURE: app and web.
 */
export type SampleRowState = 'complete' | 'partial' | 'owed' | 'optional';
export type SampleRow<F extends FormField = FormField> = { index: number; fields: F[]; state: SampleRowState };
export type SampleColumn = { label: string; unit?: string };

export const SAMPLES_NOTE = 'Basta una completa';
export const PARTIAL_SAMPLE_LINE = 'Completa esta bandeja o déjala vacía';
export const OWED_SAMPLE_LINE = 'Completa esta bandeja';
export const OPTIONAL_SAMPLE_TAG = 'OPC.';
export const OPTIONAL_SAMPLE_LABEL = 'Opcional';

const TITLE_SEPARATOR = ' · ';
const TRAILING_INDEX = /\s*\d+\s*$/;

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** One row per sample index, in order; the owed one is the first when nothing was typed (`withSampleRule`). */
export function sampleRowsOf<F extends FormField>(fields: readonly F[], values: FormValues): SampleRow<F>[] {
  const byIndex = new Map<number, F[]>();
  for (const field of fields) if (field.sample !== undefined) byIndex.set(field.sample, [...(byIndex.get(field.sample) ?? []), field]);
  const indexes = [...byIndex.keys()].sort((a, b) => a - b);
  const filledOf = (row: F[]) => row.filter((field) => !isBlankAnswer(values[field.name])).length;
  const anyTyped = indexes.some((index) => filledOf(byIndex.get(index)!) > 0);
  return indexes.map((index) => {
    const row = byIndex.get(index)!;
    const filled = filledOf(row);
    const state: SampleRowState = filled === row.length ? 'complete' : filled > 0 ? 'partial' : !anyTyped && index === indexes[0] ? 'owed' : 'optional';
    return { index, fields: row, state };
  });
}

/** «Bandeja 1 · peso vacío» → «Peso vacío»: the column header, from the first row's fields. */
export function sampleColumnsOf(fields: readonly FormField[]): SampleColumn[] {
  const first = sampleRowsOf(fields, {})[0];
  return (first?.fields ?? []).map((field) => {
    const cut = field.label.lastIndexOf(TITLE_SEPARATOR);
    const label = capitalized(cut >= 0 ? field.label.slice(cut + TITLE_SEPARATOR.length).trim() : field.label.replace(TRAILING_INDEX, ''));
    return { label, ...(field.kind === 'number' && field.unit ? { unit: field.unit } : {}) };
  });
}

/** «B1»: the initial of the row's title and its index. */
export const sampleTagOf = (row: SampleRow): string => `${(row.fields[0]?.label.trim().charAt(0) || '#').toUpperCase()}${row.index}`;

/** The line under a row: a half-filled one is said while typing; after saving, the owed one and any field's own error. */
export function sampleRowMessage(row: SampleRow, errors: Record<string, string>): string | undefined {
  if (row.state === 'partial') return PARTIAL_SAMPLE_LINE;
  const own = row.fields.map((field) => errors[field.name]).find(Boolean);
  if (!own) return undefined;
  return row.state === 'owed' ? OWED_SAMPLE_LINE : own;
}
