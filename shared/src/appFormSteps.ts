import type { FormField } from './appForms.js';

/**
 * Which fields of a form that splits an amount wear a step number (design gst-02: «1. ¿A QUÉ VA?»,
 * «2. SERVICIO», «3. PARTIDAS DEL SERVICIO»). PURE: the APK and the web.
 *
 * A step is what the person has to decide in order: what the others depend on, the long list to pick
 * from, and the list of ticks. The way to split (a few short options in two columns) is not a step: it
 * is the pills of the partidas'. Only a form with a list of ticks is dressed this way; every other form
 * keeps its labels.
 */
const isStep = (field: FormField): boolean => {
  if (field.kind === 'list') return Boolean(field.pickBy);
  return field.kind === 'choice' && field.columns !== 2 && (field.step === true || field.searchable);
};

/** A form with a list of ticks, even while it is hidden: it wears the design from the first step. */
export const isSplitForm = (fields: readonly FormField[]): boolean => fields.some((field) => field.kind === 'list' && Boolean(field.pickBy));

/**
 * The form wears design gst-02 from its first step: it splits an amount, or it declares sections (agentes 13/11:
 * «Revisar gasto» is one form whose first mode, one partida, has no list of ticks yet; its look must not jump when the
 * person picks another way to split).
 */
export const isDesignedForm = (fields: readonly FormField[]): boolean => isSplitForm(fields) || fields.some((field) => field.section !== undefined);

/** The number of each step among the fields on screen (`shown`), in order; none when the form is not the designed one. */
export function numberedStepsOf(fields: readonly FormField[], shown: readonly FormField[] = fields): Record<string, number> {
  if (!isDesignedForm(fields)) return {};
  return Object.fromEntries(shown.filter(isStep).map((field, index) => [field.name, index + 1]));
}
