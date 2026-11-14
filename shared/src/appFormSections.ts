import { cutAtWord } from './textCut.js';
import type { FormField, FormValues } from './appForms.js';

/**
 * Sections of a form (agentes 13/11: «Corregir datos» folded under the steps of «Revisar gasto»). A field says
 * `x-section: "Corregir datos"` and, to start folded, `x-collapsed: true`; the fields side by side with the same
 * header share one block the person can open. PURE: the APK and the web.
 */
export type FieldSection = { label: string; collapsed: boolean };

const SECTION_LABEL_MAX = 40;

/** What the field's own schema says about its section: none without a header. */
export function sectionOf(property: { 'x-section'?: unknown; 'x-collapsed'?: unknown }): { section?: FieldSection } {
  const raw = property['x-section'];
  const label = typeof raw === 'string' ? cutAtWord(raw.replace(/\s+/g, ' ').trim(), SECTION_LABEL_MAX) : '';
  return label ? { section: { label, collapsed: property['x-collapsed'] === true } } : {};
}

/** A header as a piece of an id for tests and accessibility: «Corregir datos» → «corregir-datos». */
export const sectionSlug = (label: string): string => label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Nothing answered: no value, a blank text or an empty list. */
export const isBlankAnswer = (value: unknown): boolean => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/** What the screen draws: a run of plain fields, or the fields that sit under one header. */
export type FormBlock<F extends { section?: FieldSection }> = { kind: 'plain'; fields: F[] } | { kind: 'section'; label: string; collapsed: boolean; fields: F[] };

/**
 * The fields on screen in blocks: neighbours with the same header go together, and the plain ones in between stay a
 * run so they can still share a row. The same header after another field is a second block. A section starts folded
 * only when every one of its fields asks for it.
 */
export function groupedBySection<F extends { section?: FieldSection }>(fields: readonly F[]): FormBlock<F>[] {
  const blocks: FormBlock<F>[] = [];
  for (const field of fields) {
    const last = blocks[blocks.length - 1];
    if (!field.section) {
      if (last?.kind === 'plain') last.fields.push(field);
      else blocks.push({ kind: 'plain', fields: [field] });
    } else if (last?.kind === 'section' && last.label === field.section.label) {
      last.fields.push(field);
      last.collapsed = last.collapsed && field.section.collapsed;
    } else blocks.push({ kind: 'section', label: field.section.label, collapsed: field.section.collapsed, fields: [field] });
  }
  return blocks;
}

/** A field inside has an error, or one of its rows does (`list[0].field`): a folded section must open to show it. */
export function sectionHasError(fields: readonly FormField[], errors: Readonly<Record<string, string>>): boolean {
  const paths = Object.keys(errors);
  return fields.some((field) => paths.some((path) => path === field.name || path.startsWith(`${field.name}[`)));
}

/** A required field inside is blank (the voucher did not give the amount): nothing required may hide. */
export const sectionHasBlankRequired = (fields: readonly FormField[], values: FormValues): boolean => fields.some((field) => field.required && isBlankAnswer(values[field.name]));
