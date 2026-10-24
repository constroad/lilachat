import { cutAtWord } from './textCut.js';
/**
 * An app's form (R160, like Slack's modals; José, 23/10: mark attendance,
 * register material, measure a tank, from the space). Agentes builds it from
 * the `inputSchema` of the product's write tool and sends it as the answer to
 * a command; the person fills it and sending it is their confirmation. PURE:
 * the server checks the spec and the values with this, the app and the web
 * draw the fields with it.
 */
export type FormSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  enum?: unknown[];
  format?: string;
  maxLength?: number;
  /** Only `^\\d{N}$` means something here: a one-time code of N digits. */
  pattern?: string;
  minimum?: number;
  maximum?: number;
  default?: unknown;
  properties?: Record<string, FormSchemaProperty>;
  'x-input'?: string;
  'x-unit'?: string;
  'x-labels'?: Record<string, string>;
  /** The standard way to name options: `[{ "const": "<id>", "title": "Tanque 1" }]`, same as `enum` + `x-labels`. */
  oneOf?: { const?: unknown; title?: string }[];
  /** Shown only when another field has one of these answers: `{ "accion": ["salida"] }` (R161). */
  'x-visible-if'?: Record<string, unknown[]>;
};
export type FormSchema = { type?: string; description?: string; properties?: Record<string, FormSchemaProperty>; required?: string[] };
export type AppForm = { id: string; title: string; submitLabel?: string; /** The schema's `description`: a line under the title. */ intro?: string; schema: FormSchema };

type Base = { name: string; label: string; help?: string; required: boolean; /** Shown only when these fields have one of these answers. */ visibleIf?: Record<string, string[]>; /** The schema's `default`, the field's starting value. */ initial?: string | number };
export type FormField =
  | (Base & { kind: 'choice'; options: { value: string; label: string }[]; segmented: boolean })
  | (Base & { kind: 'text'; multiline: boolean; maxLength?: number; /** A one-time code of this many digits (connecting an account). */ digits?: number })
  | (Base & { kind: 'number'; unit?: string; min?: number; max?: number; integer: boolean })
  | (Base & { kind: 'date'; withTime: boolean })
  | (Base & { kind: 'photo' })
  | (Base & { kind: 'location' });
export type FormValues = Record<string, unknown>;
export type GeoPoint = { lat: number; lng: number; precision: number; /** How old the reading was when it was sent (ms, the phone's own clock on both ends): signing takes only a reading of now (José, 24/10). */ age?: number };

export const FORM_LIMITS = { id: 64, title: 60, submitLabel: 40, intro: 240, fields: 20, label: 60, help: 160, options: 50, text: 2000 };
/** Up to this many options fit side by side (design e-28); more go to a list. */
const SEGMENTED_MAX = 4;
/** A text allowed longer than this gets several lines. */
const MULTILINE_FROM = 120;
const FORM_ID = /^[a-z][a-z0-9_-]*$/;
const INPUTS = ['photo', 'location', 'textarea', 'otp'];
/** A code longer than this is not typed by hand. */
const CODE_MAX_DIGITS = 8;
const DIGITS_PATTERN = /^\^\\d\{(\d)\}\$$/;
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const line = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
/** «nota_corta» → «Nota corta» when the schema gives no title. */
const labelOf = (name: string) => name.replace(/[_-]+/g, ' ').replace(/^./, (first) => first.toUpperCase());

/**
 * The options of a choice, from `enum` (+ `x-labels`) or from `oneOf` with
 * `const` and `title`. A repeated value is kept once: Portal's material list
 * sent one id twice and the sheet drew two rows with the same key (E2E 24/10).
 */
function choiceOptions(property: FormSchemaProperty): { value: string; label: string }[] | null {
  const labels = record(property['x-labels']);
  const pairs = Array.isArray(property.enum)
    ? property.enum.map((value) => ({ value: String(value), title: labels[String(value)] }))
    : Array.isArray(property.oneOf) && property.oneOf.some((option) => record(option).const !== undefined)
      ? property.oneOf.map(record).filter((option) => option.const !== undefined).map((option) => ({ value: String(option.const), title: option.title }))
      : null;
  if (!pairs) return null;
  const unique = pairs.filter((pair, index) => pairs.findIndex((other) => other.value === pair.value) === index);
  return unique.slice(0, FORM_LIMITS.options).map((pair) => ({ value: pair.value, label: line(pair.title, FORM_LIMITS.label) || labelOf(pair.value) }));
}

function fieldOf(name: string, property: FormSchemaProperty, required: boolean): FormField | string {
  const input = property['x-input'];
  if (input !== undefined && !INPUTS.includes(input)) return `El campo «${name}» pide x-input «${input}», que Lilachat no sabe dibujar.`;
  const visibleIf = visibleIfOf(property['x-visible-if']);
  const base: Base = { name, label: line(property.title, FORM_LIMITS.label) || labelOf(name), ...(property.description ? { help: line(property.description, FORM_LIMITS.help) } : {}), required, ...(visibleIf ? { visibleIf } : {}) };
  if (input === 'photo') return { ...base, kind: 'photo' };
  if (input === 'location') return { ...base, kind: 'location' };
  const options = choiceOptions(property);
  if (options) {
    const initial = options.some((option) => option.value === String(property.default)) ? { initial: String(property.default) } : {};
    return { ...base, ...initial, kind: 'choice', options, segmented: options.length <= SEGMENTED_MAX };
  }
  if (property.type === 'number' || property.type === 'integer') {
    const initial = typeof property.default === 'number' && Number.isFinite(property.default) ? { initial: property.default } : {};
    return { ...base, ...initial, kind: 'number', ...(property['x-unit'] ? { unit: line(property['x-unit'], 12) } : {}), ...(typeof property.minimum === 'number' ? { min: property.minimum } : {}), ...(typeof property.maximum === 'number' ? { max: property.maximum } : {}), integer: property.type === 'integer' };
  }
  if (property.type === 'string' && (property.format === 'date' || property.format === 'date-time')) return { ...base, kind: 'date', withTime: property.format === 'date-time' };
  if (property.type === 'string') {
    const maxLength = typeof property.maxLength === 'number' ? Math.min(property.maxLength, FORM_LIMITS.text) : undefined;
    const digits = codeDigitsOf(input, property, maxLength);
    const initial = typeof property.default === 'string' && property.default.trim() ? { initial: line(property.default, maxLength ?? FORM_LIMITS.text) } : {};
    return { ...base, ...initial, kind: 'text', multiline: !digits && (input === 'textarea' || (maxLength ?? 0) > MULTILINE_FROM), ...(maxLength ? { maxLength } : {}), ...(digits ? { digits } : {}) };
  }
  return `El campo «${name}» es de un tipo que Lilachat no sabe dibujar.`;
}

/** `x-input: otp`, or a `^\\d{N}$` pattern that an older Lilachat draws as a short text: N digits to type. */
function codeDigitsOf(input: string | undefined, property: FormSchemaProperty, maxLength: number | undefined): number | undefined {
  const fromPattern = typeof property.pattern === 'string' ? Number(DIGITS_PATTERN.exec(property.pattern)?.[1]) : NaN;
  const digits = Number.isInteger(fromPattern) ? fromPattern : input === 'otp' ? maxLength : undefined;
  return digits && digits > 0 && digits <= CODE_MAX_DIGITS ? digits : undefined;
}

/** What a form starts with: each visible field's `default` (agentes prefills the verified phone, 23/10). */
export function initialValues(fields: readonly FormField[]): FormValues {
  return Object.fromEntries(fields.filter((field) => field.initial !== undefined).map((field) => [field.name, field.initial]));
}

function visibleIfOf(raw: unknown): Record<string, string[]> | null {
  const entries = Object.entries(record(raw)).flatMap(([name, answers]) => (Array.isArray(answers) && answers.length ? [[name, answers.map(String)] as const] : []));
  return entries.length ? Object.fromEntries(entries) : null;
}

/** The fields shown with these answers: a field with `visibleIf` waits until one of its answers is picked. */
export function visibleFields<F extends Pick<FormField, 'visibleIf'>>(fields: readonly F[], values: FormValues): F[] {
  return fields.filter((field) => !field.visibleIf || Object.entries(field.visibleIf).every(([name, answers]) => answers.includes(String(values[name] ?? ''))));
}

/** The fields to draw, in the schema's order. A field Lilachat cannot draw throws: `validateFormSpec` catches it first. */
export function formFields(form: AppForm): FormField[] {
  const required = new Set(form.schema.required ?? []);
  return Object.entries(form.schema.properties ?? {}).map(([name, property]) => {
    const field = fieldOf(name, property, required.has(name));
    if (typeof field === 'string') throw new Error(field);
    return field;
  });
}

/** What the app answered with `response_type: "form"`: refused with a reason when it cannot be drawn. */
export function validateFormSpec(raw: unknown): { ok: true; form: AppForm } | { ok: false; message: string } {
  const body = record(raw);
  const id = typeof body.id === 'string' ? body.id : '';
  if (!FORM_ID.test(id) || id.length > FORM_LIMITS.id) return { ok: false, message: '«form.id» va en minúsculas (a-z, 0-9, _ o -).' };
  const title = cutAtWord(line(body.title, FORM_LIMITS.text), FORM_LIMITS.title);
  if (!title) return { ok: false, message: 'Falta «form.title».' };
  const schema = record(body.schema) as FormSchema;
  const properties = record(schema.properties) as Record<string, FormSchemaProperty>;
  if (schema.type !== 'object' || Object.keys(properties).length === 0) return { ok: false, message: '«form.schema» va con type "object" y al menos un campo.' };
  if (Object.keys(properties).length > FORM_LIMITS.fields) return { ok: false, message: `Un formulario lleva hasta ${FORM_LIMITS.fields} campos.` };
  const required = Array.isArray(schema.required) ? schema.required.filter((name): name is string => typeof name === 'string' && name in properties) : [];
  const intro = line(schema.description, FORM_LIMITS.intro);
  const submitLabel = cutAtWord(line(body.submit_label, FORM_LIMITS.text), FORM_LIMITS.submitLabel);
  const form: AppForm = { id, title, ...(submitLabel ? { submitLabel } : {}), ...(intro ? { intro } : {}), schema: { type: 'object', properties, required } };
  for (const [name, property] of Object.entries(properties)) {
    const field = fieldOf(name, record(property) as FormSchemaProperty, false);
    if (typeof field === 'string') return { ok: false, message: field };
  }
  return { ok: true, form };
}

const isGeoPoint = (value: unknown): value is GeoPoint => {
  const point = record(value);
  return typeof point.lat === 'number' && typeof point.lng === 'number' && typeof point.precision === 'number' && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 && point.precision >= 0;
};
const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** One value: the clean value, or the message for the person (neutral Spanish, under the field). */
function checkValue(field: FormField, value: unknown): { value: unknown } | { error: string } {
  switch (field.kind) {
    case 'choice':
      return field.options.some((option) => option.value === value) ? { value } : { error: 'Elige una de las opciones.' };
    case 'text': {
      if (field.digits) {
        const code = String(value).replace(/\s+/g, '');
        return new RegExp(`^\\d{${field.digits}}$`).test(code) ? { value: code } : { error: `Escribe los ${field.digits} dígitos.` };
      }
      const text = String(value).trim();
      return field.maxLength && text.length > field.maxLength ? { error: `Hasta ${field.maxLength} caracteres.` } : { value: text.slice(0, FORM_LIMITS.text) };
    }
    case 'number': {
      const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
      if (!Number.isFinite(number)) return { error: 'Va un número.' };
      if (field.integer && !Number.isInteger(number)) return { error: 'Va un número entero.' };
      if ((field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) return { error: field.min !== undefined && field.max !== undefined ? `Entre ${field.min} y ${field.max}.` : field.min !== undefined ? `Desde ${field.min}.` : `Hasta ${field.max}.` };
      return { value: number };
    }
    case 'date':
      return Number.isNaN(new Date(String(value)).getTime()) ? { error: 'La fecha no es válida.' } : { value: String(value) };
    case 'photo':
      return typeof value === 'string' && value.length > 0 ? { value } : { error: 'Falta la foto.' };
    case 'location':
      // Only what the app's schema has: `age` is Lilachat's own check and never travels (agentes, 24/10: strict schemas).
      return isGeoPoint(value) ? { value: { lat: value.lat, lng: value.lng, precision: value.precision } } : { error: 'La ubicación no es válida.' };
  }
}

const MISSING: Record<FormField['kind'], string> = { choice: 'Elige una opción.', text: 'Escribe algo aquí.', number: 'Escribe un número.', date: 'Elige una fecha.', photo: 'Falta la foto.', location: 'Falta tu ubicación.' };

/** A signing's location older than this when sent is not «now». */
export const FRESH_LOCATION_MS = 2 * 60_000;

/**
 * The photo of a form that also asks for the location is a live selfie
 * (pending 94, design e-32): the camera opens inside the form and the button
 * takes it, with a reading of where the person is right now.
 */
export function liveSelfieFieldOf<F extends Pick<FormField, 'kind' | 'name'>>(fields: readonly F[]): F | null {
  return fields.some((field) => field.kind === 'location') ? (fields.find((field) => field.kind === 'photo') ?? null) : null;
}

/** «Firmar» takes the camera on and the place of NOW, never one the phone kept (José, 24/10). */
function staleLocation(fields: readonly FormField[], input: FormValues, values: FormValues): Record<string, string> {
  if (!liveSelfieFieldOf(fields)) return {};
  return Object.fromEntries(fields.filter((field) => field.kind === 'location' && values[field.name] !== undefined).flatMap((field) => {
    const age = record(input[field.name]).age;
    if (typeof age !== 'number') return [[field.name, 'Actualiza Lilachat: para marcar se lee tu ubicación de ahora.']];
    return age < 0 || age > FRESH_LOCATION_MS ? [[field.name, 'Tu ubicación no es de ahora: vuelve a marcar.']] : [];
  }));
}

/** What the person sent: only the form's fields, cleaned, or a message per field. With `requireFresh` (the server), a signing's location must be of now. */
export function validateFormValues(fields: readonly FormField[], raw: unknown, options: { requireFresh?: boolean } = {}): { ok: true; values: FormValues } | { ok: false; errors: Record<string, string> } {
  const input = record(raw);
  const values: FormValues = {};
  const errors: Record<string, string> = {};
  // A field hidden by the other answers is neither required nor sent.
  for (const field of visibleFields(fields, input)) {
    const value = input[field.name];
    if (isEmpty(value)) {
      if (field.required) errors[field.name] = MISSING[field.kind];
      continue;
    }
    const checked = checkValue(field, value);
    if ('error' in checked) errors[field.name] = checked.error;
    else values[field.name] = checked.value;
  }
  if (options.requireFresh) Object.assign(errors, staleLocation(fields, input, values));
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}
