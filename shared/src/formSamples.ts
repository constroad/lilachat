import type { FormField, FormSchema, FormSchemaProperty, FormValues } from './appForms.js';
import { isBlankAnswer } from './appFormSections.js';

/**
 * Numbered samples of a form: CTL-IMP's trays («pesoSin1 · pesoCon1 · area1», ×3).
 * José 19/11: «obliga a llenar las 3 bandejas». One complete sample is enough; a sample
 * started is checked whole; with nothing typed, the first one is owed. Only the sections
 * listed in `SAMPLED_FORMS` get it: a CON-CAP keeps all its points owed («5 puntos =
 * incompleto»). PURE: server, app, web.
 */
export const SAMPLE_KEY = 'x-sample';
/** Report type → the forms whose numbered fields are samples. */
export const SAMPLED_FORMS: Readonly<Record<string, readonly string[]>> = { 'CTL-IMP': ['bandejas'] };
const SAMPLE_MIN_GROUPS = 2;
const NUMBERED = /^(.*\D)([1-9])$/;

export const isSampledForm = (reportType: string, form: string): boolean => SAMPLED_FORMS[reportType]?.includes(form) ?? false;

/** The sample's index of a number field named «<base><digit>», when at least two bases repeat over two or more indices. */
function sampleIndexes(properties: Record<string, FormSchemaProperty>): Map<string, number> {
  const bases = new Map<string, Map<string, number>>();
  for (const [name, property] of Object.entries(properties)) {
    const match = property.type === 'number' || property.type === 'integer' ? NUMBERED.exec(name) : null;
    if (!match) continue;
    const [, base = '', digit = ''] = match;
    bases.set(base, (bases.get(base) ?? new Map()).set(name, Number(digit)));
  }
  const repeated = [...bases.values()].filter((names) => names.size >= SAMPLE_MIN_GROUPS);
  return repeated.length >= SAMPLE_MIN_GROUPS ? new Map(repeated.flatMap((names) => [...names])) : new Map();
}

/** Each sample's fields marked with its index; only the lowest index stays required (the star shows on it alone). */
export function sampledSchema(schema: FormSchema): FormSchema {
  const indexes = sampleIndexes(schema.properties ?? {});
  if (!indexes.size) return schema;
  const first = Math.min(...indexes.values());
  const properties = Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, property]) => [name, indexes.has(name) ? { ...property, [SAMPLE_KEY]: indexes.get(name) } : property]));
  const required = schema.required?.filter((name) => (indexes.get(name) ?? first) === first);
  return { ...schema, properties, ...(required ? { required } : {}) };
}

/** `x-sample` of a schema property, when it is a valid index. */
export const sampleOf = (property: FormSchemaProperty): { sample?: number } => {
  const index = property[SAMPLE_KEY];
  return typeof index === 'number' && Number.isInteger(index) && index > 0 ? { sample: index } : {};
};

/**
 * The errors of a form with samples: a started sample owes all its fields; an untouched one owes
 * nothing unless nothing was typed at all, and then only the first. `missing` is the form's own
 * «Escribe un número.».
 */
export function withSampleRule(fields: readonly FormField[], input: FormValues, errors: Record<string, string>, missing: (field: FormField) => string): Record<string, string> {
  const sampled = fields.filter((field) => field.sample !== undefined);
  if (!sampled.length) return errors;
  const touched = new Set(sampled.filter((field) => !isBlankAnswer(input[field.name])).map((field) => field.sample));
  const owed = touched.size ? touched : new Set([Math.min(...sampled.map((field) => field.sample ?? 0))]);
  const next = { ...errors };
  for (const field of sampled) {
    if (!isBlankAnswer(input[field.name])) continue;
    if (owed.has(field.sample)) next[field.name] ??= missing(field);
    else delete next[field.name];
  }
  return next;
}
