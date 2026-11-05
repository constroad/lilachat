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
export type FormSection = { kind: 'form'; id: string; title: string; required: boolean; enabled: boolean; state: SectionState; summary: string[]; results: SectionResult[]; form: string; /** The tool that fills it instead of its form: the photos go one by one through `agregar_foto_de_informe`. */ tool?: string; values: FormValues; /** The `clientKey` of a save Portal has not confirmed yet. */ pending?: string };
export type SectionTemplate = { id: string; title: string; required: boolean; form: string; tool?: string };
export type RepeatItem = { id: string; title: string; summary: string[]; results: SectionResult[]; sections: FormSection[] };
export type RepeatSection = { kind: 'repeat'; id: string; title: string; required: boolean; enabled: boolean; state: SectionState; summary: string[]; itemTitle: string; addLabel: string; min: number; template: SectionTemplate[]; items: RepeatItem[] };
export type DocumentSection = FormSection | RepeatSection;
/** `id` is null until the first section is saved: Portal creates nothing on a read. */
export type FieldDocument = { id: string | null; type: string; title: string; status: DocumentStatus; forms: Record<string, FormSchema>; sections: DocumentSection[]; publish: { label: string; missing: string[] } };
/** Where a section lives: a top-level one has `key` = `sectionId`; inside a repeat, `itemId` null means a new item. */
export type SectionPath = { sectionId: string; itemId: string | null; key: string };
export type PendingSave = { path: SectionPath; values: FormValues; clientKey: string };
export type SaveDecision = 'confirm' | 'retry' | 'drop' | 'flush';

const LIMITS = { title: 80, line: 160, lines: 10, results: 8, sections: 30, items: 50 };
const PENDING_TEXT = 'Hay cambios sin enviar.';

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

function formSectionOf(raw: Raw, forms: Record<string, FormSchema>, template?: SectionTemplate): FormSection | null {
  const id = template?.id ?? text(raw.id, LIMITS.title);
  const title = template?.title ?? text(raw.title, LIMITS.title);
  const form = template?.form ?? text(raw.form, LIMITS.title);
  if (!id || !title || !(form in forms)) return null;
  const tool = template?.tool ?? text(raw.tool, LIMITS.title);
  return {
    kind: 'form', id, title, form, ...(tool ? { tool } : {}),
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
    template.push({ id, title, required: one.required === true, form, ...(tool ? { tool } : {}) });
  }
  return template;
}

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
  return { id, title: text(raw.title, LIMITS.title) || id, summary: lines(raw.summary), results: resultsOf(raw.results), sections };
}

function repeatOf(raw: Raw, forms: Record<string, FormSchema>): RepeatSection | null {
  const id = text(raw.id, LIMITS.title);
  const title = text(raw.title, LIMITS.title);
  const repeat = record(raw.repeat);
  const template = templateOf(repeat.template, forms);
  if (!id || !title || !template) return null;
  const items: RepeatItem[] = [];
  for (const entry of (Array.isArray(raw.items) ? raw.items : []).slice(0, LIMITS.items)) {
    const item = itemOf(record(entry), template, forms);
    if (!item) return null;
    items.push(item);
  }
  const min = typeof repeat.min === 'number' && repeat.min > 0 ? Math.floor(repeat.min) : 0;
  return {
    kind: 'repeat', id, title, template, items, min,
    required: raw.required === true, enabled: raw.enabled !== false,
    state: oneOf(raw.state, SECTION_STATES, 'empty'), summary: lines(raw.summary),
    itemTitle: text(repeat.itemTitle, LIMITS.title) || title, addLabel: text(repeat.addLabel, LIMITS.title) || 'Agregar',
  };
}

function sectionsOf(raw: unknown, forms: Record<string, FormSchema>): DocumentSection[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.sections) return null;
  const sections: DocumentSection[] = [];
  for (const entry of raw) {
    const one = record(entry);
    const section = 'repeat' in one ? repeatOf(one, forms) : formSectionOf(one, forms);
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
  return { id, type, title, status, forms, sections, publish: { label: text(publish.label, LIMITS.title) || 'Publicar informe', missing: lines(publish.missing) } };
}

type Found = { title: string; form: string; tool?: string; values: FormValues };

/** The section behind a path; inside a repeat, a null `itemId` is a new item on the template, empty. */
function sectionAt(document: FieldDocument, path: SectionPath): Found | null {
  const section = document.sections.find((one) => one.id === path.sectionId);
  if (!section) return null;
  if (section.kind === 'form') return path.key === section.id ? { title: section.title, form: section.form, ...(section.tool ? { tool: section.tool } : {}), values: section.values } : null;
  const entry = section.template.find((one) => one.id === path.key);
  if (!entry) return null;
  const tool = entry.tool ? { tool: entry.tool } : {};
  if (path.itemId === null) return { title: `${section.itemTitle} · ${entry.title}`, form: entry.form, ...tool, values: {} };
  const item = section.items.find((one) => one.id === path.itemId);
  const saved = item?.sections.find((one) => one.id === path.key);
  return item && saved ? { title: `${item.title} · ${entry.title}`, form: entry.form, ...tool, values: saved.values } : null;
}

const withDefault = (property: FormSchemaProperty, value: unknown): FormSchemaProperty => (value === undefined || value === '' ? property : { ...property, default: value });

/** The section as the form the engine draws: `guardar_seccion_de_informe` (or the section's own tool) with the saved values as defaults. */
export function sectionFormOf(document: FieldDocument, path: SectionPath): AppForm | null {
  const found = sectionAt(document, path);
  const schema = found ? document.forms[found.form] : undefined;
  if (!found || !schema) return null;
  const properties = Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, property]) => [name, withDefault(property, found.values[name])]));
  return { id: found.tool ?? SECTION_TOOL, title: found.title, schema: { ...schema, properties } };
}

type Leaf = { path: SectionPath; required: boolean; done: boolean; enabled: boolean };

function leavesOf(document: FieldDocument): Leaf[] {
  const leaves: Leaf[] = [];
  for (const section of document.sections) {
    if (section.kind === 'form') {
      leaves.push({ path: { sectionId: section.id, itemId: null, key: section.id }, required: section.required, done: section.state === 'done', enabled: section.enabled });
      continue;
    }
    const owed = section.items.length === 0 && (section.required || section.min > 0);
    if (owed) section.template.forEach((entry) => leaves.push({ path: { sectionId: section.id, itemId: null, key: entry.id }, required: entry.required, done: false, enabled: section.enabled }));
    for (const item of section.items) {
      item.sections.forEach((one) => leaves.push({ path: { sectionId: section.id, itemId: item.id, key: one.id }, required: one.required, done: one.state === 'done', enabled: section.enabled }));
    }
  }
  return leaves;
}

/** Required sections done over required sections, the tramos' included. */
export function progressOf(document: FieldDocument): { done: number; total: number } {
  const required = leavesOf(document).filter((leaf) => leaf.required);
  return { done: required.filter((leaf) => leaf.done).length, total: required.length };
}

/** The first required section still open, or null when all are done. */
export function nextSection(document: FieldDocument): SectionPath | null {
  return leavesOf(document).find((leaf) => leaf.required && leaf.enabled && !leaf.done)?.path ?? null;
}

const savedForm = (section: FormSection, values: FormValues, clientKey: string): FormSection => ({ ...section, values, state: 'partial', pending: clientKey });

/** The phone keeps what was saved before Portal answers; the same document comes back when the path is not there. */
export function applySavedSection(document: FieldDocument, path: SectionPath, values: FormValues, clientKey: string): FieldDocument {
  let touched = false;
  const sections = document.sections.map((section): DocumentSection => {
    if (section.id !== path.sectionId) return section;
    if (section.kind === 'form') {
      if (path.key !== section.id) return section;
      touched = true;
      return savedForm(section, values, clientKey);
    }
    const items = section.items.map((item) => {
      if (item.id !== path.itemId || !item.sections.some((one) => one.id === path.key)) return item;
      touched = true;
      return { ...item, sections: item.sections.map((one) => (one.id === path.key ? savedForm(one, values, clientKey) : one)) };
    });
    return { ...section, items };
  });
  return touched ? { ...document, sections } : document;
}

const samePath = (left: SectionPath, right: SectionPath): boolean => left.sectionId === right.sectionId && left.itemId === right.itemId && left.key === right.key;

/** One save per section, the newest; a section already queued keeps its place in line. */
export function queueSave(queue: readonly PendingSave[], save: PendingSave): PendingSave[] {
  return queue.some((one) => samePath(one.path, save.path)) ? queue.map((one) => (samePath(one.path, save.path) ? save : one)) : [...queue, save];
}

export const nextSave = (queue: readonly PendingSave[]): PendingSave | null => queue[0] ?? null;

/** After Portal answered a save (`rn-app-loop` §5): 409 is success, a final 4xx drops, 401 empties the queue, the rest retries. */
export function afterSave(status: number | null): SaveDecision {
  if (status === null || status === 408 || status === 429 || status >= 500) return 'retry';
  if (status === 401) return 'flush';
  if (status === 409 || status < 400) return 'confirm';
  return 'drop';
}

/** Why «Publicar» waits: what Portal says is missing, and saves still in the queue. */
export function publishBlockers(document: FieldDocument, queue: readonly PendingSave[]): string[] {
  return queue.length ? [...document.publish.missing, PENDING_TEXT] : [...document.publish.missing];
}
