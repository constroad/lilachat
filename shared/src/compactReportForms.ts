import type { FieldWidth, FormSchema, FormSchemaProperty } from './appForms.js';

/**
 * Report forms drawn compact (José 19/11 on the CTL-IMP: «botones grandes, diseños feos»; design
 * imp-01/02/03): 44 px fields, a 52 px button, the lane as chips and the progresivas before it. Only
 * how it looks: the values saved and what Portal reads stay the same. PURE: app and web.
 */
export const LANE_CHIPS: readonly string[] = ['Derecho', 'Izquierdo', 'Ambos'];

type CompactHint = {
  /** Form key → the fields it draws first, in this order. */ order: Record<string, readonly string[]>;
  /** Form key → text field → its chips. */ chips: Record<string, Record<string, readonly string[]>>;
  /** Form key → field → its width, so the design's pairs hold whatever reaches Lilachat. */ widths: Record<string, Record<string, FieldWidth>>;
};

const COMPACT_REPORTS: Readonly<Record<string, CompactHint>> = {
  'CTL-IMP': {
    order: { ubicacion: ['tramo', 'progresivaDesde', 'progresivaHasta', 'carril', 'horaInicio', 'horaFinal'] },
    chips: { ubicacion: { carril: LANE_CHIPS } },
    widths: { ubicacion: { tramo: 'full', progresivaDesde: 'half', progresivaHasta: 'half' } },
  },
};

export const isCompactReport = (reportType: string): boolean => Object.hasOwn(COMPACT_REPORTS, reportType);

/** The listed fields first in their order, the rest after them as they came. */
function ordered(properties: Record<string, FormSchemaProperty>, order: readonly string[]): Record<string, FormSchemaProperty> {
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  return Object.fromEntries(Object.entries(properties).sort(([a], [b]) => rank(a) - rank(b)));
}

type FormHints = { order?: readonly string[]; chips?: Record<string, readonly string[]>; widths?: Record<string, FieldWidth> };

/** What the report's hint says about one of its forms. */
function hintsOf(reportType: string, formKey: string): FormHints {
  const hint = isCompactReport(reportType) ? COMPACT_REPORTS[reportType] : undefined;
  if (!hint) return {};
  const pick = <T>(byForm: Record<string, T>): T | undefined => (Object.hasOwn(byForm, formKey) ? byForm[formKey] : undefined);
  return { order: pick(hint.order), chips: pick(hint.chips), widths: pick(hint.widths) };
}

/** The chips go on text fields only: what is saved stays the same string. */
function withChips(properties: Record<string, FormSchemaProperty>, chips: Record<string, readonly string[]>): void {
  for (const [name, options] of Object.entries(chips)) {
    const property = properties[name];
    if (property?.type === 'string') properties[name] = { ...property, 'x-chips': [...options] };
  }
}

function withWidths(properties: Record<string, FormSchemaProperty>, widths: Record<string, FieldWidth>): void {
  for (const [name, width] of Object.entries(widths)) {
    const property = properties[name];
    if (property) properties[name] = { ...property, 'x-width': width };
  }
}

/** The section's schema with the compact hints of its report; any other comes back as it is. */
export function compactSectionSchema(reportType: string, formKey: string, schema: FormSchema): FormSchema {
  const { order, chips, widths } = hintsOf(reportType, formKey);
  if (!order && !chips && !widths) return schema;
  const properties = ordered(schema.properties ?? {}, order ?? []);
  withChips(properties, chips ?? {});
  withWidths(properties, widths ?? {});
  return { ...schema, properties };
}

/** Chips side by side: a few short words. */
const CHIPS_MAX = 6;
const CHIP_CHARS = 20;

/** `x-chips` of a text when it is a list of short texts; anything else is ignored. */
export function textChipsOf(raw: unknown): { chips?: string[] } {
  if (!Array.isArray(raw)) return {};
  const chips = raw.filter((chip): chip is string => typeof chip === 'string' && chip.trim() !== '').map((chip) => chip.replace(/\s+/g, ' ').trim().slice(0, CHIP_CHARS)).slice(0, CHIPS_MAX);
  return chips.length ? { chips } : {};
}
