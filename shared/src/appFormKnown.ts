import type { ShortcutValues } from './appActions.js';
import { formFields, validateFormValues, type AppForm, type FormField } from './appForms.js';

export type KnownAnswers = { form: AppForm; context: ShortcutValues };

/** A value the field itself would take; a field that shows only with another answer cannot be checked alone. */
const answers = (field: FormField, value: ShortcutValues[string]): boolean => !field.visibleIf && validateFormValues([field], { [field.name]: value }).ok;

/**
 * A form opened from a place that already knows an answer (José 06/11: the link of a service asked
 * for the service again): that field is not asked, and its value rides with the answers. A value the
 * form does not offer keeps the field, a field others depend on stays, and a form left empty stays whole.
 */
export function withoutKnownFields(form: AppForm, known: ShortcutValues): KnownAnswers {
  const fields = formFields(form);
  const dependedOn = new Set(fields.flatMap((field) => Object.keys(field.visibleIf ?? {})));
  const answered = fields.filter((field) => field.name in known && !dependedOn.has(field.name) && answers(field, known[field.name]!));
  if (!answered.length || answered.length === fields.length) return { form, context: {} };
  const names = new Set(answered.map((field) => field.name));
  const properties = Object.fromEntries(Object.entries(form.schema.properties ?? {}).filter(([name]) => !names.has(name)));
  const required = form.schema.required?.filter((name) => !names.has(name));
  return { form: { ...form, schema: { ...form.schema, properties, ...(required ? { required } : {}) } }, context: Object.fromEntries(answered.map((field) => [field.name, known[field.name]!])) };
}
