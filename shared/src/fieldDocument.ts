import { validateFormSpec, type AppForm, type FormSchema, type FormSchemaProperty, type FormValues } from './appForms.js';

/**
 * A field report filled from Lilachat by sections (José 05/11/2026, spec
 * INFORMES-DESDE-LILACHAT §3.1). Portal's field-report tool answers the
 * document: which sections it has, each one's form, values, state and the
 * results Portal computed. Every section is a real form of the engine, saved
 * through `guardar_seccion_de_informe`; a repeat (the tramos) stamps the same
 * template on each item. PURE: the app and the web draw from this, the server
 * builds each section's run from `sectionFormOf`.
 */
export const SECTION_TOOL = 'guardar_seccion_de_informe';
export const DOCUMENT_STATUSES = ['draft', 'published'] as const;
export const SECTION_STATES = ['empty', 'partial', 'done', 'error'] as const;
export const RESULT_TONES = ['ok', 'warn', 'error', 'neutral'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type SectionState = (typeof SECTION_STATES)[number];
export type ResultTone = (typeof RESULT_TONES)[number];
export type SectionResult = { label: string; value: string; tone: ResultTone };
/** What a photo section asks of the device (CTL-PIS, José 06/11): the `tipoFoto` it sends, and no photo without the GPS fix. */
export type PhotoMarks = { photoKind?: string; requireLocation?: true };
export type FormSection = PhotoMarks & { kind: 'form'; id: string; title: string; required: boolean; enabled: boolean; state: SectionState; summary: string[]; results: SectionResult[]; form: string; /** The tool that fills it instead of its form: the photos go one by one through `agregar_foto_de_informe`. */ tool?: string; values: FormValues; /** The `clientKey` of a save Portal has not confirmed yet. */ pending?: string };
export type SectionTemplate = PhotoMarks & { id: string; title: string; required: boolean; form: string; tool?: string };
/** The window of items on screen when Portal pages them (50 units of a control de pista). */
export type ItemsPage = { current: number; total: number };
export type RepeatItem = { id: string; title: string; summary: string[]; results: SectionResult[]; sections: FormSection[] };
export type RepeatSection = { kind: 'repeat'; id: string; title: string; required: boolean; enabled: boolean; state: SectionState; summary: string[]; /** Over all the items (Portal's Carros, Volumen, Terminadas). */ results: SectionResult[]; itemTitle: string; addLabel: string; /** False when the items come from elsewhere (the dispatches of an order): no «Agregar». */ canAdd: boolean; page?: ItemsPage; min: number; template: SectionTemplate[]; items: RepeatItem[] };
export type DocumentSection = FormSection | RepeatSection;
/** `id` is null until the first section is saved: Portal creates nothing on a read. */
export type FieldDocument = { id: string | null; type: string; title: string; status: DocumentStatus; forms: Record<string, FormSchema>; sections: DocumentSection[]; publish: { label: string; missing: string[]; /** Shown without blocking «Publicar» (dispatches of the order with no row yet). */ warnings: string[] } };
/** Where a section lives: a top-level one has `key` = `sectionId`; inside a repeat, `itemId` null means a new item. */
export type SectionPath = { sectionId: string; itemId: string | null; key: string };

const LIMITS = { title: 80, line: 160, lines: 10, results: 8, sections: 30, items: 50 };
const PENDING_TEXT = 'Hay cambios sin enviar.';
const OFFLINE_TEXT = 'Publicar necesita señal.';

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {});
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const lines = (value: unknown): string[] => (Array.isArray(value) ? value.map((one) => text(one, LIMITS.line)).filter(Boolean).slice(0, LIMITS.lines) : []);
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => (options.includes(value as T) ? (value as T) : fallback);

function resultsOf(value: unknown): SectionResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((one) => ({ label: text(record(one).label, LIMITS.line), value: text(record(one).value, LIMITS.line), tone: oneOf(record(one).tone, RESULT_TONES, 'neutral') }))
    .filter((one) => one.label && one.value)
    .slice(0, LIMITS.results);
}

/** Each form has to be one the engine draws: a document with one it cannot is refused whole. */
function formsOf(raw: unknown): Record<string, FormSchema> | null {
  const forms: Record<string, FormSchema> = {};
  for (const [key, schema] of Object.entries(record(raw))) {
    const checked = validateFormSpec({ id: SECTION_TOOL, title: key, schema });
    if (!checked.ok) return null;
    forms[key] = checked.form.schema;
  }
  return forms;
}

/** `photoKind` and `requireLocation` as Portal writes them on a template entry or a section. */
function photoMarksOf(raw: Raw): PhotoMarks {
  const photoKind = text(raw.photoKind, LIMITS.title);
  return { ...(photoKind ? { photoKind } : {}), ...(raw.requireLocation === true ? { requireLocation: true as const } : {}) };
}

function formSectionOf(raw: Raw, forms: Record<string, FormSchema>, template?: SectionTemplate): FormSection | null {
  const id = template?.id ?? text(raw.id, LIMITS.title);
  const title = template?.title ?? text(raw.title, LIMITS.title);
  const form = template?.form ?? text(raw.form, LIMITS.title);
  if (!id || !title || !(form in forms)) return null;
  const tool = template?.tool ?? text(raw.tool, LIMITS.title);
  const marks = template ? { ...(template.photoKind ? { photoKind: template.photoKind } : {}), ...(template.requireLocation ? { requireLocation: true as const } : {}) } : photoMarksOf(raw);
  return {
    kind: 'form', id, title, form, ...(tool ? { tool } : {}), ...marks,
    required: template ? template.required : raw.required === true,
    enabled: raw.enabled !== false,
    state: oneOf(raw.state, SECTION_STATES, 'empty'),
    summary: lines(raw.summary), results: resultsOf(raw.results), values: record(raw.values),
  };
}

function templateOf(raw: unknown, forms: Record<string, FormSchema>): SectionTemplate[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const template: SectionTemplate[] = [];
  for (const entry of raw) {
    const one = record(entry);
    const id = text(one.id, LIMITS.title);
    const title = text(one.title, LIMITS.title);
    const form = text(one.form, LIMITS.title);
    if (!id || !title || !(form in forms)) return null;
    const tool = text(one.tool, LIMITS.title);
    template.push({ id, title, required: one.required === true, form, ...(tool ? { tool } : {}), ...photoMarksOf(one) });
  }
  return template;
}

/** «Unidad 1 · » when the plate is not known yet: the separator with nothing beside it goes (audit 12/11). */
const withoutLooseSeparator = (title: string): string => title.replace(/^\s*·\s*|\s*·\s*$/g, '').trim();

/** An item carries only state and values per section; titles and forms come from the template. */
function itemOf(raw: Raw, template: SectionTemplate[], forms: Record<string, FormSchema>): RepeatItem | null {
  const id = text(raw.id, LIMITS.title);
  if (!id) return null;
  const given = Array.isArray(raw.sections) ? raw.sections.map(record) : [];
  const sections: FormSection[] = [];
  for (const entry of template) {
    const section = formSectionOf(given.find((one) => one.id === entry.id) ?? {}, forms, entry);
    if (!section) return null;
    sections.push(section);
  }
  return { id, title: withoutLooseSeparator(text(raw.title, LIMITS.title)) || id, summary: lines(raw.summary), results: resultsOf(raw.results), sections };
}

/** `{ current, total }` from 1, or nothing: a page off its book is no page. */
function pageOf(raw: unknown): ItemsPage | undefined {
  const { current, total } = record(raw);
  const whole = typeof current === 'number' && typeof total === 'number' && Number.isInteger(current) && Number.isInteger(total);
  return whole && current >= 1 && current <= total ? { current, total } : undefined;
}

/** José 06/11: the units of a control de pista are the order's dispatches, nobody adds one. An empty «Agregar» says the same. */
const canAddOf = (repeat: Raw): boolean => repeat.canAdd !== false && !(typeof repeat.addLabel === 'string' && repeat.addLabel.trim() === '');

function repeatOf(raw: Raw, forms: Record<string, FormSchema>): RepeatSection | null {
  const id = text(raw.id, LIMITS.title);
  const title = text(raw.title, LIMITS.title);
  // Portal sends the repeat's own keys flat beside `kind: 'repeat'` (7841b285); the spec's nested `repeat` is read too.
  const repeat = 'repeat' in raw ? record(raw.repeat) : raw;
  const template = templateOf(repeat.template, forms);
  if (!id || !title || !template) return null;
  const items: RepeatItem[] = [];
  for (const entry of (Array.isArray(raw.items) ? raw.items : []).slice(0, LIMITS.items)) {
    const item = itemOf(record(entry), template, forms);
    if (!item) return null;
    items.push(item);
  }
  const min = typeof repeat.min === 'number' && repeat.min > 0 ? Math.floor(repeat.min) : 0;
  const page = pageOf(repeat.page);
  return {
    kind: 'repeat', id, title, template, items, min, canAdd: canAddOf(repeat), ...(page ? { page } : {}),
    required: raw.required === true, enabled: raw.enabled !== false,
    state: oneOf(raw.state, SECTION_STATES, 'empty'), summary: lines(raw.summary), results: resultsOf(repeat.results ?? raw.results),
    itemTitle: text(repeat.itemTitle, LIMITS.title) || title, addLabel: text(repeat.addLabel, LIMITS.title) || 'Agregar',
  };
}

function sectionsOf(raw: unknown, forms: Record<string, FormSchema>): DocumentSection[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.sections) return null;
  const sections: DocumentSection[] = [];
  for (const entry of raw) {
    const one = record(entry);
    const section = one.kind === 'repeat' || 'repeat' in one ? repeatOf(one, forms) : formSectionOf(one, forms);
    if (!section) return null;
    sections.push(section);
  }
  return sections;
}

/** Portal says `completed` once published (05/11): here it is `published`; anything else it may invent is refused. */
const statusOf = (value: unknown): DocumentStatus | null => (value === 'completed' ? 'published' : DOCUMENT_STATUSES.includes(value as DocumentStatus) ? (value as DocumentStatus) : null);

/** What Portal answered for `informe_de_campo`, or null when it cannot be drawn. */
export function fieldDocumentOf(body: unknown): FieldDocument | null {
  const raw = record(body);
  const id = raw.id === null ? null : text(raw.id, LIMITS.title);
  const type = text(raw.type, LIMITS.title);
  const title = text(raw.title, LIMITS.title);
  const status = statusOf(raw.status);
  if (id === '' || !type || !title || !status) return null;
  const forms = formsOf(raw.forms);
  const sections = forms ? sectionsOf(raw.sections, forms) : null;
  if (!forms || !sections) return null;
  const publish = record(raw.publish);
  return { id, type, title, status, forms, sections, publish: { label: text(publish.label, LIMITS.title) || 'Publicar informe', missing: lines(publish.missing), warnings: lines(publish.warnings) } };
}

type Found = PhotoMarks & { title: string; form: string; tool?: string; values: FormValues };

const marksOf = ({ photoKind, requireLocation }: PhotoMarks): PhotoMarks => ({ ...(photoKind ? { photoKind } : {}), ...(requireLocation ? { requireLocation } : {}) });

/** The section behind a path; inside a repeat, a null `itemId` is a new item on the template, empty. */
export function sectionAt(document: FieldDocument, path: SectionPath): Found | null {
  const section = document.sections.find((one) => one.id === path.sectionId);
  if (!section) return null;
  if (section.kind === 'form') return path.key === section.id ? { title: section.title, form: section.form, ...(section.tool ? { tool: section.tool } : {}), ...marksOf(section), values: section.values } : null;
  const entry = section.template.find((one) => one.id === path.key);
  if (!entry) return null;
  const tool = { ...(entry.tool ? { tool: entry.tool } : {}), ...marksOf(entry) };
  if (path.itemId === null) return { title: itemFormTitle(section.itemTitle, entry.title), form: entry.form, ...tool, values: {} };
  const item = section.items.find((one) => one.id === path.itemId);
  const saved = item?.sections.find((one) => one.id === path.key);
  return item && saved ? { title: itemFormTitle(item.title, entry.title), form: entry.form, ...tool, values: saved.values } : null;
}

/** «Tramo 1 · Ubicación»; a section named like its item says it once: «Punto 1», never «Punto 1 · Punto» (E2E 12/11). */
export function itemFormTitle(itemTitle: string, sectionTitle: string): string {
  const same = itemTitle === sectionTitle || itemTitle.startsWith(`${sectionTitle} `);
  return same ? itemTitle : `${itemTitle} · ${sectionTitle}`;
}

/** The `tipoFoto` the photo tool gets for this section, when Portal fixed one. */
export const photoKindOf = (document: FieldDocument, path: SectionPath): string | undefined => sectionAt(document, path)?.photoKind;
/** José 06/11: «sin GPS no hay foto»; the section says so, and both the phone and the server refuse the capture without a fix. */
export const requiresLocation = (document: FieldDocument, path: SectionPath): boolean => sectionAt(document, path)?.requireLocation === true;

/** The channel is the client's and the report hangs from a service (José, 06/11): nobody types them. */
const KNOWN_BY_CHANNEL = ['cliente', 'proyecto'];

const withDefault = (property: FormSchemaProperty, value: unknown): FormSchemaProperty => (value === undefined || value === '' ? property : { ...property, default: value });

/** The section as the form the engine draws: `guardar_seccion_de_informe` (or the section's own tool) with the saved values as defaults. */
export function sectionFormOf(document: FieldDocument, path: SectionPath): AppForm | null {
  const found = sectionAt(document, path);
  const schema = found ? document.forms[found.form] : undefined;
  if (!found || !schema) return null;
  const asked = Object.entries(schema.properties ?? {}).filter(([name]) => !KNOWN_BY_CHANNEL.includes(name));
  const properties = Object.fromEntries(asked.map(([name, property]) => [name, withDefault(property, found.values[name])]));
  const required = schema.required?.filter((name) => !KNOWN_BY_CHANNEL.includes(name));
  // Audit 12/11: «Enviar» on a part of a draft read as sending the report; it only keeps that part.
  const submitLabel = asked.some(([, property]) => property['x-input'] === 'photo') ? 'Guardar foto' : 'Guardar';
  return { id: found.tool ?? SECTION_TOOL, title: found.title, submitLabel, schema: { ...schema, properties, ...(required ? { required } : {}) }, ...(schema['x-check-all'] ? { checkAll: true as const } : {}) };
}

/** Portal's own value of what the form does not ask: it rides with the answers, because Portal blanks a field a saved section leaves out. */
export function channelValuesOf(document: FieldDocument, path: SectionPath): Record<string, string> {
  const values = sectionAt(document, path)?.values ?? {};
  const known = KNOWN_BY_CHANNEL.map((name) => [name, values[name]] as const);
  return Object.fromEntries(known.filter((pair): pair is readonly [string, string] => typeof pair[1] === 'string' && pair[1] !== ''));
}

type Leaf = { path: SectionPath; required: boolean; done: boolean; enabled: boolean };

function leavesOf(document: FieldDocument): Leaf[] {
  const leaves: Leaf[] = [];
  for (const section of document.sections) {
    if (section.kind === 'form') {
      leaves.push({ path: { sectionId: section.id, itemId: null, key: section.id }, required: section.required, done: section.state === 'done', enabled: section.enabled });
      continue;
    }
    const owed = section.items.length === 0 && section.canAdd && (section.required || section.min > 0);
    if (owed) section.template.forEach((entry) => leaves.push({ path: { sectionId: section.id, itemId: null, key: entry.id }, required: entry.required, done: false, enabled: section.enabled }));
    for (const item of section.items) {
      item.sections.forEach((one) => leaves.push({ path: { sectionId: section.id, itemId: item.id, key: one.id }, required: one.required, done: one.state === 'done', enabled: section.enabled }));
    }
  }
  return leaves;
}

/** Required sections done over required sections, the tramos' included: what «Siguiente» walks. */
export function progressOf(document: FieldDocument): { done: number; total: number } {
  const required = leavesOf(document).filter((leaf) => leaf.required);
  return { done: required.filter((leaf) => leaf.done).length, total: required.length };
}

/**
 * The hub's line and bar: the cards a person sees (audit 12/11 on the APK: «1 de 28 secciones
 * listas» with six cards, because each of five units counted its five parts). A repeat is done
 * when Portal says so; its own card says how many units or tramos are.
 */
export function sectionsProgressOf(document: FieldDocument): { done: number; total: number } {
  const required = document.sections.filter((section) => section.required || (section.kind === 'repeat' && section.min > 0));
  return { done: required.filter((section) => section.state === 'done').length, total: required.length };
}

/** The first required section still open, or null when all are done. */
export function nextSection(document: FieldDocument): SectionPath | null {
  return leavesOf(document).find((leaf) => leaf.required && leaf.enabled && !leaf.done)?.path ?? null;
}

const savedForm = (section: FormSection, values: FormValues, clientKey: string, state: SectionState): FormSection => ({ ...section, values, state, pending: clientKey });

/** The phone keeps what was saved before Portal answers; the same document comes back when the path is not there. */
export function applySavedSection(document: FieldDocument, path: SectionPath, values: FormValues, clientKey: string, state: SectionState = 'partial'): FieldDocument {
  let touched = false;
  const sections = document.sections.map((section): DocumentSection => {
    if (section.id !== path.sectionId) return section;
    if (section.kind === 'form') {
      if (path.key !== section.id) return section;
      touched = true;
      return savedForm(section, values, clientKey, state);
    }
    const items = section.items.map((item) => {
      if (item.id !== path.itemId || !item.sections.some((one) => one.id === path.key)) return item;
      touched = true;
      return { ...item, sections: item.sections.map((one) => (one.id === path.key ? savedForm(one, values, clientKey, state) : one)) };
    });
    return { ...section, items };
  });
  return touched ? { ...document, sections } : document;
}

/** The line over «Publicar» (design j-05): the first blocker and the first warning, «Falta: … · 2 volquetes por llegar». */
export function publishFooterLine(document: FieldDocument, blockers: readonly string[]): string | undefined {
  const line = [blockers[0], document.publish.warnings[0]].filter(Boolean).join(' · ');
  return line || undefined;
}

/** Why «Publicar» waits: what Portal says is missing, saves still in the queue, and no signal (Portal validates and makes the PDF). */
export function publishBlockers(document: FieldDocument, queue: readonly unknown[], offline = false): string[] {
  return [...document.publish.missing, ...(queue.length ? [PENDING_TEXT] : []), ...(offline ? [OFFLINE_TEXT] : [])];
}

/** Portal's «Enviar al grupo» on a report photo: the WhatsApp to the client's group (Portal 0b9a77c1). */
export const GROUP_SEND_FIELD = 'enviarAlGrupo';

function formWithoutGroupSend(form: FormSchema): FormSchema {
  if (!form.properties || !(GROUP_SEND_FIELD in form.properties)) return form;
  const { [GROUP_SEND_FIELD]: _send, ...properties } = form.properties;
  return { ...form, properties, ...(form.required ? { required: form.required.filter((key) => key !== GROUP_SEND_FIELD) } : {}) };
}

/** José 12/11: «lo de enviar por whatsapp solo admins en lilachat». A member's forms come without it; Portal refuses it too. */
export function withoutGroupSend(document: FieldDocument, admin: boolean): FieldDocument {
  if (admin) return document;
  return { ...document, forms: Object.fromEntries(Object.entries(document.forms).map(([key, form]) => [key, formWithoutGroupSend(form)])) };
}
