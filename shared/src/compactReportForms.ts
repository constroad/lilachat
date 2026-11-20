import type { FormSchema, FormSchemaProperty } from './appForms.js';

/**
 * Report forms drawn compact (José 19/11 on the CTL-IMP: «botones grandes, diseños feos»; design
 * imp-01/02/03): 44 px fields, a 52 px button, the lane as chips and the progresivas before it. Only
 * how it looks: the values saved and what Portal reads stay the same. PURE: app and web.
 */
export const LANE_CHIPS: readonly string[] = ['Derecho', 'Izquierdo', 'Ambos'];

type CompactHint = { /** Form key → the fields it draws first, in this order. */ order: Record<string, readonly string[]>; /** Form key → text field → its chips. */ chips: Record<string, Record<string, readonly string[]>> };

const COMPACT_REPORTS: Readonly<Record<string, CompactHint>> = {
  'CTL-IMP': {
    order: { ubicacion: ['tramo', 'progresivaDesde', 'progresivaHasta', 'carril', 'horaInicio', 'horaFinal'] },
    chips: { ubicacion: { carril: LANE_CHIPS } },
  },
};

export const isCompactReport = (reportType: string): boolean => Object.hasOwn(COMPACT_REPORTS, reportType);

/** The listed fields first in their order, the rest after them as they came. */
function ordered(properties: Record<string, FormSchemaProperty>, order: readonly string[]): Record<string, FormSchemaProperty> {
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  return Object.fromEntries(Object.entries(properties).sort(([a], [b]) => rank(a) - rank(b)));
}

/** The section's schema with the compact hints of its report; any other comes back as it is. */
export function compactSectionSchema(reportType: string, formKey: string, schema: FormSchema): FormSchema {
  const hint = isCompactReport(reportType) ? COMPACT_REPORTS[reportType] : undefined;
  const order = hint && Object.hasOwn(hint.order, formKey) ? hint.order[formKey] : undefined;
  const chips = hint && Object.hasOwn(hint.chips, formKey) ? hint.chips[formKey] : undefined;
  if (!order && !chips) return schema;
  const properties = ordered(schema.properties ?? {}, order ?? []);
  for (const [name, options] of Object.entries(chips ?? {})) {
    const property = properties[name];
    if (property?.type === 'string') properties[name] = { ...property, 'x-chips': [...options] };
  }
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
