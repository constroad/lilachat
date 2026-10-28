import { cutAtWord } from './textCut.js';
import { normalizeFormDate, startingMoment, type DateMode } from './formDates.js';
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
  /** With `x-input: photo` and `type: array`: how many photos (José, 24/10: several, removable). */
  minItems?: number;
  maxItems?: number;
  title?: string;
  description?: string;
  enum?: unknown[];
  format?: string;
  maxLength?: number;
  /** Only `^\\d{N}$` means something here: a one-time code of N digits. */
  pattern?: string;
  minimum?: number;
  maximum?: number;
  /** zod's `.positive()`: the edge itself is out (E2E 28/10: an expense of 0 reached the app). */
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  default?: unknown;
  properties?: Record<string, FormSchemaProperty>;
  /** A list's item (`type: object`) and which of its fields are required (José and agentes, 28/10). */
  items?: FormSchemaProperty;
  required?: string[];
  /** The list's button: «Agregar producto». Without it, «Agregar fila». */
  'x-add-label'?: string;
  /** A list of photos that also takes them from the gallery (a transfer receipt is a screenshot); only the camera without it. */
  'x-gallery'?: boolean;
  'x-input'?: string;
  'x-unit'?: string;
  'x-labels'?: Record<string, string>;
  /** The standard way to name options: `[{ "const": "<id>", "title": "Tanque 1" }]`, same as `enum` + `x-labels`. */
  oneOf?: { const?: unknown; title?: string; description?: string }[];
  /** Shown only when another field has one of these answers: `{ "accion": ["salida"] }` (R161). */
  'x-visible-if'?: Record<string, unknown[]>;
  /** Half a row beside another short field, or the whole row (José, 28/10: forms were a field per row). Without it, `formRows` decides. */
  'x-width'?: FieldWidth;
  /** `initials`: the options are people (a client, an employee) and get their initials; without it, none (agentes, 28/10). */
  'x-avatar'?: 'initials';
};
/** How much of a row a field takes: half beside another, or all of it. */
export type FieldWidth = 'half' | 'full';
export type FormSchema = { type?: string; description?: string; properties?: Record<string, FormSchemaProperty>; required?: string[] };
export type AppForm = { id: string; title: string; submitLabel?: string; /** The schema's `description`: a line under the title. */ intro?: string; schema: FormSchema };

/** An option of a choice; `sub` is the line under it in a long list (the person's role). */
export type ChoiceOption = { value: string; label: string; sub?: string };

type Base = { name: string; label: string; help?: string; required: boolean; /** The app's `x-width`. */ width?: FieldWidth; /** Shown only when these fields have one of these answers. */ visibleIf?: Record<string, string[]>; /** The schema's `default`, the field's starting value. */ initial?: string | number };
export type FormField =
  | (Base & { kind: 'choice'; options: ChoiceOption[]; segmented: boolean; /** A long list (the company's people, agentes 24/10): a field that opens a sheet with a search. */ searchable: boolean; /** `x-avatar: initials`: each option with its initials. */ initials?: true })
  | (Base & { kind: 'text'; multiline: boolean; maxLength?: number; /** A one-time code of this many digits (connecting an account). */ digits?: number; /** `x-input: pin`: digits typed hidden, never prefilled nor kept (Portal's employee PIN). */ secret?: true })
  | (Base & { kind: 'number'; unit?: string; min?: number; max?: number; /** The limit itself is out: «Mayor que 0». */ minExclusive?: true; maxExclusive?: true; integer: boolean })
  | (Base & { kind: 'date'; /** `format: date | time | date-time`: a picker for the day, the hour or both (José, 24/10). */ mode: DateMode })
  | (Base & { kind: 'photo'; /** A list (`type: array`) where each photo can be removed and taken again; otherwise one photo. */ multiple: boolean; max: number; min: number; /** `x-gallery`: also from the gallery. */ gallery?: true })
  | (Base & { kind: 'location' })
  | (Base & {
      kind: 'list';
      /** Each item's fields: anything but another list or a location. */
      fields: ItemField[];
      min: number;
      max: number;
      addLabel: string;
      /** Up to three short fields side by side (José, 28/10: «carros» and «m³» in one row); otherwise a card per item. */
      layout: 'row' | 'card';
      /** The schema's `default`, cut to the item's own keys and to `max`. */
      initialItems?: FormValues[];
    });
/** A field inside a list's item. */
export type ItemField = Exclude<FormField, { kind: 'list' } | { kind: 'location' }>;
export type FormValues = Record<string, unknown>;
export type GeoPoint = { lat: number; lng: number; precision: number; /** How old the reading was when it was sent (ms, the phone's own clock on both ends): signing takes only a reading of now (José, 24/10). */ age?: number };

export const FORM_LIMITS = { id: 64, title: 60, submitLabel: 40, intro: 240, fields: 20, label: 60, help: 160, options: 300, text: 2000, pin: 8, photos: 10, items: 20, itemFields: 8 };
/** Up to this many options fit side by side (design e-28); more go to a list. */
const SEGMENTED_MAX = 4;
/** Side by side, the longest label times the number of options must fit this many characters: «Refrigerio» ×4 does, three mix designs do not. */
const SEGMENTED_ROW_CHARS = 40;
/** More options than this become a field with a search (a company's 31 people did not fit as buttons). */
export const SEARCHABLE_FROM = 8;
/** A database id (Mongo ObjectId or UUID): options with these are records that grow, never a fixed set. */
const RECORD_ID = /^(?:[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** A list of photos without `maxItems`. */
const DEFAULT_MAX_PHOTOS = 6;
/** A list of items without `maxItems`. */
const DEFAULT_MAX_ITEMS = 10;
/** More fields than this per item, or a long or conditional one, and the item is a card instead of a row. */
const ROW_MAX_FIELDS = 3;
/** A text allowed longer than this gets several lines. */
const MULTILINE_FROM = 120;
const FORM_ID = /^[a-z][a-z0-9_-]*$/;
const INPUTS = ['photo', 'location', 'textarea', 'otp', 'pin'];
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
function choiceOptions(property: FormSchemaProperty): ChoiceOption[] | null {
  const labels = record(property['x-labels']);
  const pairs: { value: string; title: unknown; description?: unknown }[] | null = Array.isArray(property.enum)
    ? property.enum.map((value) => ({ value: String(value), title: labels[String(value)] }))
    : Array.isArray(property.oneOf) && property.oneOf.some((option) => record(option).const !== undefined)
      ? property.oneOf.map(record).filter((option) => option.const !== undefined).map((option) => ({ value: String(option.const), title: option.title, description: option.description }))
      : null;
  if (!pairs) return null;
  const unique = pairs.filter((pair, index) => pairs.findIndex((other) => other.value === pair.value) === index);
  return unique.slice(0, FORM_LIMITS.options).map((pair) => {
    const sub = line(pair.description, FORM_LIMITS.label);
    return { value: pair.value, label: line(pair.title, FORM_LIMITS.label) || labelOf(pair.value), ...(sub ? { sub } : {}) };
  });
}

/** One photo, or a list of them when the schema is an array (minItems/maxItems, at most 10). */
function photoField(base: Base, property: FormSchemaProperty): FormField {
  if (property.type !== 'array') return { ...base, kind: 'photo', multiple: false, max: 1, min: base.required ? 1 : 0 };
  const max = Math.min(FORM_LIMITS.photos, Math.max(1, Math.floor(property.maxItems ?? DEFAULT_MAX_PHOTOS)));
  const min = Math.min(max, Math.max(base.required ? 1 : 0, Math.floor(property.minItems ?? 0)));
  return { ...base, required: min > 0, kind: 'photo', multiple: true, max, min, ...(property['x-gallery'] === true ? { gallery: true as const } : {}) };
}

/** A row holds short typed values only: numbers and one-line texts, none that waits for another answer. */
function fitsInRow(fields: readonly ItemField[]): boolean {
  return fields.length <= ROW_MAX_FIELDS && fields.every((field) => !field.visibleIf && (field.kind === 'number' || (field.kind === 'text' && !field.multiline && !field.secret && !field.digits)));
}

/** The app's `default` items, with only the item's own keys and plain values. */
function defaultItems(raw: unknown, fields: readonly ItemField[], max: number): FormValues[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const names = new Set(fields.map((field) => field.name));
  const items = raw.slice(0, max).map((item) => Object.fromEntries(Object.entries(record(item)).filter(([name, value]) => names.has(name) && (typeof value === 'string' || typeof value === 'number'))));
  return items.length ? items : undefined;
}

/** An array of objects (José and agentes, 28/10: the order's trucks, the quote's products). */
function listField(base: Base, property: FormSchemaProperty): FormField | string {
  const item = record(property.items) as FormSchemaProperty;
  const entries = Object.entries(record(item.properties));
  if (item.type !== 'object' || entries.length === 0) return `La lista «${base.name}» va con items de type "object" y al menos un campo.`;
  if (entries.length > FORM_LIMITS.itemFields) return `Un ítem de «${base.name}» lleva hasta ${FORM_LIMITS.itemFields} campos.`;
  const required = new Set(Array.isArray(item.required) ? item.required : []);
  const fields: ItemField[] = [];
  for (const [name, child] of entries) {
    const field = fieldOf(name, record(child) as FormSchemaProperty, required.has(name));
    if (typeof field === 'string') return field;
    if (field.kind === 'list' || field.kind === 'location') return `Dentro de «${base.name}» no va ${field.kind === 'list' ? 'otra lista' : 'una ubicación'}.`;
    fields.push(field);
  }
  const max = Math.min(FORM_LIMITS.items, Math.max(1, Math.floor(property.maxItems ?? DEFAULT_MAX_ITEMS)));
  const min = Math.min(max, Math.max(base.required ? 1 : 0, Math.floor(property.minItems ?? 0)));
  const initialItems = defaultItems(property.default, fields, max);
  const addLabel = line(property['x-add-label'], FORM_LIMITS.label) || 'Agregar fila';
  return { ...base, required: min > 0, kind: 'list', fields, min, max, addLabel, layout: fitsInRow(fields) ? 'row' : 'card', ...(initialItems ? { initialItems } : {}) };
}

/** A number's limits, an exclusive one winning over an inclusive one at the same edge or inside it. */
function numberLimits(property: FormSchemaProperty): Pick<Extract<FormField, { kind: 'number' }>, 'min' | 'max' | 'minExclusive' | 'maxExclusive'> {
  const { minimum, maximum, exclusiveMinimum, exclusiveMaximum } = property;
  const lowExclusive = typeof exclusiveMinimum === 'number' && (typeof minimum !== 'number' || exclusiveMinimum >= minimum);
  const highExclusive = typeof exclusiveMaximum === 'number' && (typeof maximum !== 'number' || exclusiveMaximum <= maximum);
  return {
    ...(lowExclusive ? { min: exclusiveMinimum, minExclusive: true as const } : typeof minimum === 'number' ? { min: minimum } : {}),
    ...(highExclusive ? { max: exclusiveMaximum, maxExclusive: true as const } : typeof maximum === 'number' ? { max: maximum } : {}),
  };
}

function fieldOf(name: string, property: FormSchemaProperty, required: boolean): FormField | string {
  const input = property['x-input'];
  if (input !== undefined && !INPUTS.includes(input)) return `El campo «${name}» pide x-input «${input}», que Lilachat no sabe dibujar.`;
  const visibleIf = visibleIfOf(property['x-visible-if']);
  const width = property['x-width'] === 'half' || property['x-width'] === 'full' ? property['x-width'] : undefined;
  const base: Base = { name, label: line(property.title, FORM_LIMITS.label) || labelOf(name), ...(property.description ? { help: line(property.description, FORM_LIMITS.help) } : {}), required, ...(visibleIf ? { visibleIf } : {}), ...(width ? { width } : {}) };
  if (input === 'photo') return photoField(base, property);
  if (property.type === 'array' && input === undefined) return listField(base, property);
  if (input === 'location') return { ...base, kind: 'location' };
  const options = choiceOptions(property);
  if (options) {
    const initial = options.some((option) => option.value === String(property.default)) ? { initial: String(property.default) } : {};
    return { ...base, ...initial, kind: 'choice', options, ...choiceLayout(options), ...(property['x-avatar'] === 'initials' ? { initials: true as const } : {}) };
  }
  if (property.type === 'number' || property.type === 'integer') {
    const initial = typeof property.default === 'number' && Number.isFinite(property.default) ? { initial: property.default } : {};
    return { ...base, ...initial, kind: 'number', ...(property['x-unit'] ? { unit: line(property['x-unit'], 12) } : {}), ...numberLimits(property), integer: property.type === 'integer' };
  }
  const mode = property.type === 'string' ? dateModeOf(property.format) : null;
  if (mode) {
    // The app's own default wins over «today»; a default that is not a date of this kind is ignored.
    const given = normalizeFormDate(property.default, mode);
    return { ...base, ...(given ? { initial: given } : {}), kind: 'date', mode };
  }
  if (property.type === 'string') {
    // A PIN is never prefilled and never shown: no `default`, digits only, hidden while typed.
    if (input === 'pin') return { ...base, kind: 'text', multiline: false, maxLength: Math.min(typeof property.maxLength === 'number' ? property.maxLength : FORM_LIMITS.pin, FORM_LIMITS.pin), secret: true };
    const maxLength = typeof property.maxLength === 'number' ? Math.min(property.maxLength, FORM_LIMITS.text) : undefined;
    const digits = codeDigitsOf(input, property, maxLength);
    const initial = typeof property.default === 'string' && property.default.trim() ? { initial: line(property.default, maxLength ?? FORM_LIMITS.text) } : {};
    return { ...base, ...initial, kind: 'text', multiline: !digits && (input === 'textarea' || (maxLength ?? 0) > MULTILINE_FROM), ...(maxLength ? { maxLength } : {}), ...(digits ? { digits } : {}) };
  }
  return `El campo «${name}» es de un tipo que Lilachat no sabe dibujar.`;
}

/** How a choice is drawn: side by side while it fits, a dropdown for records, long labels and long lists, else a list of rows. */
function choiceLayout(options: ChoiceOption[]): { segmented: boolean; searchable: boolean } {
  // A list of records (carriers, quarries, sites; José, 24/10) is a dropdown even with three: side by side it squeezes long names.
  const records = options.some((option) => RECORD_ID.test(option.value));
  const longest = Math.max(0, ...options.map((option) => option.label.length));
  const fewEnough = options.length > 0 && options.length <= SEGMENTED_MAX;
  const segmented = !records && fewEnough && longest * options.length <= SEGMENTED_ROW_CHARS;
  return { segmented, searchable: records || options.length > SEARCHABLE_FROM || (fewEnough && !segmented) };
}

const dateModeOf = (format: string | undefined): DateMode | null => (format === 'date' || format === 'time' || format === 'date-time' ? format : null);

/** `x-input: otp`, or a `^\\d{N}$` pattern that an older Lilachat draws as a short text: N digits to type. */
function codeDigitsOf(input: string | undefined, property: FormSchemaProperty, maxLength: number | undefined): number | undefined {
  const fromPattern = typeof property.pattern === 'string' ? Number(DIGITS_PATTERN.exec(property.pattern)?.[1]) : NaN;
  const digits = Number.isInteger(fromPattern) ? fromPattern : input === 'otp' ? maxLength : undefined;
  return digits && digits > 0 && digits <= CODE_MAX_DIGITS ? digits : undefined;
}

/**
 * What a form starts with: each field's `default` (agentes prefills the verified phone, 23/10), and
 * today for a date or now for a moment when the app gave none (José, 24/10: «fecha actual siempre»).
 */
export function initialValues(fields: readonly FormField[], now: Date = new Date()): FormValues {
  return Object.fromEntries(fields.flatMap((field) => {
    const value = field.kind === 'list' ? startingItems(field, now) : (field.initial ?? (field.kind === 'date' ? startingMoment(field.mode, now) : undefined));
    return value === undefined ? [] : [[field.name, value]];
  }));
}

/** A new item of a list: its fields' own defaults. */
export function newItem(fields: readonly ItemField[], now: Date = new Date()): FormValues {
  return initialValues(fields, now);
}

/** The app's default items, or `min` new ones (agentes, 28/10: «arranca con minItems ítems»). */
function startingItems(field: Extract<FormField, { kind: 'list' }>, now: Date): FormValues[] {
  if (field.initialItems) return field.initialItems.map((item) => ({ ...newItem(field.fields, now), ...item }));
  return Array.from({ length: field.min }, () => newItem(field.fields, now));
}

/** Where an item's field answers, in the errors both Lilachat and the app write: `despachos[0].m3`. */
export const itemPath = (list: string, index: number, field: string): string => `${list}[${index}].${field}`;

/** The first field, in the form's order, with an error of its own or of one of its items: where the sheet scrolls to. */
export function firstErrorField(names: readonly string[], errors: Readonly<Record<string, string>>): string | null {
  const keys = Object.keys(errors);
  return names.find((name) => keys.some((key) => key === name || key.startsWith(`${name}[`))) ?? null;
}

/** Initials only when the app says its options are people: a mix design or a site is an id too, and «MM» beside it is noise (agentes, 28/10). */
export function showsInitials(field: Extract<FormField, { kind: 'choice' }>): boolean {
  return field.initials === true;
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

/**
 * What a Lilachat can draw, sent with each command (`forms`): 2 draws lists (28/10). An older
 * one sends nothing, and a form with a list would break its sheet, so it is told to update.
 */
export const FORMS_LEVEL = 2;
/** The level a form needs: 2 with a list, 1 otherwise. */
export function formLevelOf(form: AppForm): number {
  return Object.values(form.schema.properties ?? {}).some((property) => property.type === 'array' && property['x-input'] === undefined) ? 2 : 1;
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
const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/** One value: the clean value, or the message for the person (neutral Spanish, under the field). */
function checkValue(field: Exclude<FormField, { kind: 'list' }>, value: unknown): { value: unknown } | { error: string } {
  switch (field.kind) {
    case 'choice':
      return field.options.some((option) => option.value === value) ? { value } : { error: 'Elige una de las opciones.' };
    case 'text': {
      if (field.digits) {
        const code = String(value).replace(/\s+/g, '');
        return new RegExp(`^\\d{${field.digits}}$`).test(code) ? { value: code } : { error: `Escribe los ${field.digits} dígitos.` };
      }
      if (field.secret) {
        const pin = String(value).replace(/\s+/g, '');
        return /^\d+$/.test(pin) && pin.length <= (field.maxLength ?? FORM_LIMITS.pin) ? { value: pin } : { error: 'Solo números.' };
      }
      const text = String(value).trim();
      return field.maxLength && text.length > field.maxLength ? { error: `Hasta ${field.maxLength} caracteres.` } : { value: text.slice(0, FORM_LIMITS.text) };
    }
    case 'number': {
      const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
      if (!Number.isFinite(number)) return { error: 'Va un número.' };
      if (field.integer && !Number.isInteger(number)) return { error: 'Va un número entero.' };
      const low = field.min !== undefined && (field.minExclusive ? number <= field.min : number < field.min);
      const high = field.max !== undefined && (field.maxExclusive ? number >= field.max : number > field.max);
      return low || high ? { error: rangeMessage(field) } : { value: number };
    }
    case 'date': {
      const clean = normalizeFormDate(value, field.mode);
      return clean ? { value: clean } : { error: field.mode === 'time' ? 'La hora no es válida.' : 'La fecha no es válida.' };
    }
    case 'photo': {
      if (!field.multiple) return typeof value === 'string' && value.length > 0 ? { value } : { error: 'Falta la foto.' };
      const photos = Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string' && one.length > 0) : [];
      if (photos.length < field.min) return { error: field.min === 1 ? 'Falta al menos una foto.' : `Faltan fotos: van al menos ${field.min}.` };
      return photos.length > field.max ? { error: `Hasta ${field.max} fotos.` } : { value: photos };
    }
    case 'location':
      // Only what the app's schema has: `age` is Lilachat's own check and never travels (agentes, 24/10: strict schemas).
      return isGeoPoint(value) ? { value: { lat: value.lat, lng: value.lng, precision: value.precision } } : { error: 'La ubicación no es válida.' };
  }
}

/** «Entre 1 y 40.», «Mayor que 0.», «Mayor que 0 y hasta 40.» */
function rangeMessage(field: Extract<FormField, { kind: 'number' }>): string {
  const low = field.min === undefined ? '' : field.minExclusive ? `Mayor que ${field.min}` : `Desde ${field.min}`;
  const high = field.max === undefined ? '' : field.maxExclusive ? `Menor que ${field.max}` : `Hasta ${field.max}`;
  if (low && high && !field.minExclusive && !field.maxExclusive) return `Entre ${field.min} y ${field.max}.`;
  return low && high ? `${low} y ${high.charAt(0).toLowerCase()}${high.slice(1)}.` : `${low || high}.`;
}

const MISSING: Record<Exclude<FormField['kind'], 'date'>, string> = { choice: 'Elige una opción.', text: 'Escribe algo aquí.', number: 'Escribe un número.', photo: 'Falta la foto.', location: 'Falta tu ubicación.', list: 'Agrega al menos uno.' };
const missingOf = (field: FormField): string => (field.kind !== 'date' ? MISSING[field.kind] : field.mode === 'time' ? 'Elige una hora.' : 'Elige una fecha.');

/** A signing's location older than this when sent is not «now». */
export const FRESH_LOCATION_MS = 2 * 60_000;

/**
 * The photo of a form that also asks for the location is a live selfie
 * (pending 94, design e-32): the camera opens inside the form and the button
 * takes it, with a reading of where the person is right now.
 */
export function liveSelfieFieldOf<F extends Pick<FormField, 'kind' | 'name'>>(fields: readonly F[]): F | null {
  // A signature is ONE selfie: a list of photos (the tape, a delivery note) is never the live camera.
  return fields.some((field) => field.kind === 'location') ? (fields.find((field) => field.kind === 'photo' && !('multiple' in field && field.multiple)) ?? null) : null;
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
  const { values, errors } = checkFields(fields, input);
  if (options.requireFresh) Object.assign(errors, staleLocation(fields, input, values));
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

/** The shown fields of a form or of one item: a field hidden by the other answers is neither required nor sent. */
function checkFields(fields: readonly FormField[], input: FormValues): { values: FormValues; errors: Record<string, string> } {
  const values: FormValues = {};
  const errors: Record<string, string> = {};
  for (const field of visibleFields(fields, input)) {
    const value = input[field.name];
    if (isEmpty(value)) {
      if (field.required) errors[field.name] = missingOf(field);
      continue;
    }
    if (field.kind === 'list') {
      const list = checkList(field, value);
      if ('errors' in list) Object.assign(errors, list.errors);
      else values[field.name] = list.value;
      continue;
    }
    const checked = checkValue(field, value);
    if ('error' in checked) errors[field.name] = checked.error;
    else values[field.name] = checked.value;
  }
  return { values, errors };
}

/** Each item checked like a small form; its errors go under `list[i].field`, the count's under the list. */
function checkList(field: Extract<FormField, { kind: 'list' }>, value: unknown): { value: FormValues[] } | { errors: Record<string, string> } {
  const items = Array.isArray(value) ? value.map(record) : [];
  if (items.length < field.min) return { errors: { [field.name]: field.min === 1 ? MISSING.list : `Agrega al menos ${field.min}.` } };
  if (items.length > field.max) return { errors: { [field.name]: `Hasta ${field.max}.` } };
  const errors: Record<string, string> = {};
  const clean = items.map((item, index) => {
    const checked = checkFields(field.fields, item);
    for (const [name, message] of Object.entries(checked.errors)) errors[itemPath(field.name, index, name)] = message;
    return checked.values;
  });
  return Object.keys(errors).length ? { errors } : { value: clean };
}

/** «José» matches «jose», «JOSÉ»: one character at a time, so positions stay those of the label. */
const foldChar = (char: string) => char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const foldText = (text: string) => Array.from(text).map(foldChar).join('');

/** The options of a long list that match the search, without accents or capitals; empty search = all. */
export function filterChoiceOptions(options: readonly ChoiceOption[], query: string): ChoiceOption[] {
  const wanted = foldText(query.trim());
  if (!wanted) return [...options];
  return options.filter((option) => foldText(option.label).includes(wanted));
}

/** Where the search falls in a label, to tint it (design e-35); null when it does not. */
export function matchSpan(label: string, query: string): { start: number; end: number } | null {
  const wanted = foldText(query.trim());
  if (!wanted) return null;
  const start = foldText(label).indexOf(wanted);
  return start < 0 ? null : { start, end: start + wanted.length };
}
