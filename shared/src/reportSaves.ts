import type { AppForm, FormSchemaProperty, FormValues } from './appForms.js';
import type { FormSubmitReply } from './appActions.js';
import type { ViewableFile } from './fileViewer.js';
import type { CommandNotice, EphemeralAnswer } from './botCommands.js';
import { applySavedSection, sectionAt, sectionFormOf, type DocumentSection, type FieldDocument, type FormSection, type RepeatItem, type RepeatSection, type SectionPath, type SectionTemplate } from './fieldDocument.js';
import { PUBLISH_LABEL, REPORT_KEEPER, sectionBadge, type DevicePlace } from './reportCreation.js';

/**
 * What a field report keeps on the phone until Portal has it (spec
 * INFORMES-DESDE-LILACHAT §4.4): one save per section, one per photo, each the
 * fact the person confirmed, never the screen. Sections and tramos made here
 * show on the document at once, over what Portal last answered. PURE.
 */
export type ReportRef = { spaceId: string; clientId: string; chatId: string; serviceId: string; type: string };
export type QueuedPhoto = { field: string; ref: string; mime: string; preview: string };
export type SaveRefusal = { message: string; errors: Record<string, string> };
/** What the report had when the write went out: with the answer lost, it tells a write that landed. */
export type SentMark = { items: string[]; photos: number; /** The empty tramo this write fills. */ seed?: string };
export type ReportSave = {
  clientKey: string;
  ref: ReportRef;
  reportId: string | null;
  path: SectionPath;
  title: string;
  values: FormValues;
  /** A tramo made here: `path.itemId` is local until Portal gives it its id. */
  createsItem?: true;
  /** The first tramo of a report not made yet: Portal makes the report with one empty tramo, and this one fills it. */
  fillsSeed?: true;
  photo?: QueuedPhoto;
  place?: DevicePlace;
  queuedAt: string;
  attempts: number;
  refusal?: SaveRefusal;
  sent?: SentMark;
};
export type SaveVerdict = { kind: 'confirm' | 'flush' | 'wait' } | { kind: 'retry'; /** Agentes said how long: its «too many calls», not a lost signal. */ afterMs?: number } | { kind: 'refuse'; refusal: SaveRefusal };

const LOCAL_ITEM = 'local-';
const GENERAL_SECTION = 'general';
const MEMBER_FIELD = 'responsable';
const PLACE_FIELD = 'ubicacion';
/** «Hora inicio», «Hora de inicio» and CTL-PIS's «Inicio de colocación» (audit 12/11); never «Fin de…». */
const START_HOUR = /^(hora (de )?)?inicio\b/i;
const PHOTOS_VALUE = 'fotos';
const PHOTO_MIME = 'image/jpeg';
/** The viewer's action on a report's photo. It never deletes: a swipe can change which one is on screen. */
export const TAKE_ANOTHER_PHOTO = 'Tomar otra';
const SAVE_REFUSED = 'Portal no aceptó este cambio.';
const UNSENT_HTTP = new Set([408, 429]);
const SERVER_DOWN = 500;
/** Agentes' «too many calls» (06/11): the save waits what it says, or this when it says nothing. */
const RATE_LIMITED = 'rate_limited';
export const RATE_LIMIT_WAIT_MS = 5000;
const MS_PER_S = 1000;

export const reportKeyOf = ({ spaceId, clientId, serviceId, type }: ReportRef): string => [spaceId, clientId, serviceId, type].join(':');
/** The forms of a type are the same in every service of the space: they let a new report start with no signal. */
export const reportTypeKeyOf = ({ spaceId, type }: ReportRef): string => [spaceId, type].join(':');
export const savesOf = (queue: readonly ReportSave[], ref: ReportRef): ReportSave[] => queue.filter((one) => reportKeyOf(one.ref) === reportKeyOf(ref));

/** The save of a confirmed form. Inside a repeat, a null `itemId` is a new tramo: it takes a local id. */
export function reportSaveOf(input: { ref: ReportRef; document: FieldDocument; path: SectionPath; values: FormValues; clientKey: string; now: string }): ReportSave {
  const { ref, document, path, values, clientKey, now } = input;
  const inRepeat = document.sections.find((one) => one.id === path.sectionId)?.kind === 'repeat';
  const creates = inRepeat && path.itemId === null;
  return {
    clientKey, ref, values, reportId: document.id, queuedAt: now, attempts: 0,
    path: creates ? { ...path, itemId: `${LOCAL_ITEM}${clientKey}` } : path,
    title: sectionFormOf(document, path)?.title ?? path.key,
    ...(creates ? { createsItem: true as const } : {}),
    ...(creates && document.id === null && itemsOf(document, path.sectionId).length === 0 ? { fillsSeed: true as const } : {}),
  };
}

export const samePath = (left: SectionPath, right: SectionPath): boolean => left.sectionId === right.sectionId && left.itemId === right.itemId && left.key === right.key;

/** One save per section, the newest, in its place in line; a photo is its own write. A tramo not sent yet stays the save that creates it. */
export function queueSave(queue: readonly ReportSave[], save: ReportSave): ReportSave[] {
  const kept = save.photo ? undefined : queue.find((one) => !one.photo && samePath(one.path, save.path));
  if (!kept) return [...queue, save];
  const merged: ReportSave = { ...save, ...(kept.createsItem ? { createsItem: true as const } : {}), ...(kept.fillsSeed ? { fillsSeed: true as const } : {}), ...(kept.sent ? { sent: kept.sent } : {}) };
  return queue.map((one) => (one === kept ? merged : one));
}

const openSection = (section: DocumentSection): DocumentSection => ({ ...section, enabled: true });

const emptySection = ({ id, title, form, required, tool, photoKind, requireLocation }: SectionTemplate): FormSection => ({ kind: 'form', id, title, form, required, enabled: true, state: 'empty', summary: [], results: [], values: {}, ...(tool ? { tool } : {}), ...(photoKind ? { photoKind } : {}), ...(requireLocation ? { requireLocation } : {}) });

function withLocalItem(document: FieldDocument, path: SectionPath): FieldDocument {
  const sections = document.sections.map((section): DocumentSection => {
    if (section.id !== path.sectionId || section.kind !== 'repeat' || !path.itemId || section.items.some((one) => one.id === path.itemId)) return section;
    return { ...section, items: [...section.items, { id: path.itemId, title: `${section.itemTitle} ${section.items.length + 1}`, summary: [], results: [], sections: section.template.map(emptySection) }] };
  });
  return { ...document, sections };
}

const photoListAt = (document: FieldDocument, path: SectionPath): unknown[] => {
  const photos = sectionAt(document, path)?.values[PHOTOS_VALUE];
  return Array.isArray(photos) ? photos : [];
};

function withPendingPhoto(document: FieldDocument, save: ReportSave): FormValues {
  const preview = save.photo?.preview ?? '';
  return { [PHOTOS_VALUE]: [...photoListAt(document, save.path), { id: save.clientKey, url: preview, thumb_url: preview, descripcion: save.values.descripcion ?? '', pending: true }] } as FormValues;
}

/** A save over the document: it shows at once, and the first one opens what Portal keeps closed until the report exists. */
export function applySave(document: FieldDocument, save: ReportSave): FieldDocument {
  const opened = document.id === null ? { ...document, sections: document.sections.map(openSection) } : document;
  const placed = save.createsItem ? withLocalItem(opened, save.path) : opened;
  return applySavedSection(placed, save.path, save.photo ? withPendingPhoto(placed, save) : save.values, save.clientKey, save.refusal ? 'error' : 'partial');
}

export const documentWithQueue = (document: FieldDocument, queue: readonly ReportSave[]): FieldDocument => queue.reduce(applySave, document);

/** A thumbnail tapped: its section, which photo, and where «Tomar otra» goes. */
export type PhotoToView = { section: FormSection; url: string; path: SectionPath };
export type SectionPhoto = { id: string; url: string; thumbUrl: string; caption: string; hour: string; pending: boolean };
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The photos of a section as Portal lists them, and the ones still on the phone. */
export function sectionPhotos(section: Pick<FormSection, 'values'>): SectionPhoto[] {
  const photos = section.values[PHOTOS_VALUE];
  if (!Array.isArray(photos)) return [];
  return (photos as Record<string, unknown>[])
    .filter((one) => textOf(one?.url))
    .map((one) => ({ id: textOf(one.id), url: textOf(one.url), thumbUrl: textOf(one.thumb_url) || textOf(one.url), caption: textOf(one.descripcion), hour: textOf(one.hora), pending: one.pending === true }));
}

/** What the viewer opens for a tapped photo: a swipe goes through the others of its section. */
export function photoViewOf(section: Pick<FormSection, 'title' | 'values'>, url: string): { file: ViewableFile; siblings: ViewableFile[] } | null {
  const siblings = sectionPhotos(section).map((photo) => ({ url: photo.url, name: photo.caption || section.title, mime: PHOTO_MIME, thumbUrl: photo.thumbUrl }));
  const file = siblings.find((one) => one.url === url);
  return file ? { file, siblings } : null;
}

/**
 * What «Eliminar» acts on in the viewer: a draft's photo that reached Portal.
 * One still on the phone leaves through the queue, and a published report keeps its photos.
 */
export function removablePhotoId(document: Pick<FieldDocument, 'status'>, section: Pick<FormSection, 'values'>, url: string): string | null {
  if (document.status !== 'draft') return null;
  const photo = sectionPhotos(section).find((one) => one.url === url);
  return photo?.id && !photo.pending ? photo.id : null;
}

export const REMOVE_PHOTO_QUESTION = '¿Quitar esta foto del informe?';
export const REMOVE_PHOTO_LABEL = 'Quitar';

/** Names the photo in the confirmation: the viewer is closed by then. */
export function photoRemovalLine(section: Pick<FormSection, 'title' | 'values'>, url: string): string {
  const photo = sectionPhotos(section).find((one) => one.url === url);
  return [photo?.caption, photo?.hour].filter(Boolean).join(' · ') || section.title;
}

/** «0 fotos», «1 foto» (design j-03). */
export function photosLine(section: Pick<FormSection, 'values'>): string {
  const count = sectionPhotos(section).length;
  return `${count} ${count === 1 ? 'foto' : 'fotos'}`;
}

/** The line at the right of a tramo's row (design j-03): what waits, how many photos, or what Portal said. */
export function sectionRowLine(section: FormSection): string {
  if (section.pending) return sectionBadge(section.state, section.required, section.pending).label;
  if (section.tool) return photosLine(section);
  return section.summary[0] ?? sectionBadge(section.state, section.required).label;
}

/** A unit's data row, which has no title beside it: «Datos · Falta» instead of a lone «Falta» (audit 12/11). */
export const dataRowLine = (section: FormSection): string => `${section.title} · ${sectionRowLine(section)}`;

/** The save waiting on a card of the hub; a repeat waits while any of its tramos does. */
export function pendingOf(section: DocumentSection): string | undefined {
  if (section.kind === 'form') return section.pending;
  return section.items.flatMap((item) => item.sections).find((one) => one.pending)?.pending;
}

function blankSection(section: DocumentSection, index: number): DocumentSection {
  const blank = { state: 'empty' as const, summary: [], enabled: index === 0 };
  return section.kind === 'repeat' ? { ...section, ...blank, items: [] } : { ...section, ...blank, values: {}, results: [] };
}

/** A new report from what the phone knows of its type: its forms, and nothing of the report they came from. */
export const blankDocumentOf = (document: FieldDocument): FieldDocument => ({ ...document, id: null, status: 'draft', sections: document.sections.map(blankSection), publish: { label: PUBLISH_LABEL, missing: [], warnings: [] } });

/**
 * The next save to send. What was refused waits for the person, and so does what hangs from it; while the report does not exist, only its first section can make it.
 * What the person saves passes before the photos waiting (José 06/11): a section is one call, a backlog of photos is many.
 */
export function nextSave(queue: readonly ReportSave[], document: FieldDocument | null): ReportSave | null {
  const stuck = new Set(queue.filter((one) => one.refusal && one.createsItem).map((one) => one.path.itemId));
  const first = document?.sections[0]?.id;
  const ready = queue.filter((one) => !one.refusal && !stuck.has(one.path.itemId) && (document?.id !== null || one.path.sectionId === first));
  return ready.find((one) => !one.photo) ?? ready[0] ?? null;
}

const repeatItems = (document: FieldDocument, sectionId: string): RepeatItem[] => document.sections.find((one): one is RepeatSection => one.id === sectionId && one.kind === 'repeat')?.items ?? [];
const itemsOf = (document: FieldDocument, sectionId: string): string[] => repeatItems(document, sectionId).map((one) => one.id);

/** The tramo Portal made with the report, while nobody has written in it. */
function emptySeedOf(save: ReportSave, document: FieldDocument): string | null {
  const items = repeatItems(document, save.path.sectionId);
  const only = items.length === 1 ? items[0] : null;
  return save.fillsSeed && only?.sections.every((one) => one.state === 'empty') ? only.id : null;
}

/** Taken once, before the first attempt. */
export function sentMarkOf(save: ReportSave, document: FieldDocument): SentMark {
  if (save.sent) return save.sent;
  const seed = emptySeedOf(save, document);
  return { items: itemsOf(document, save.path.sectionId), photos: photoListAt(document, save.path).length, ...(seed ? { seed } : {}) };
}


/** The tramo Portal made for this save: the one the report did not have when it went out. */
export const newItemOf = (save: ReportSave, document: FieldDocument, sent: SentMark): string | null => sent.seed ?? itemsOf(document, save.path.sectionId).find((id) => !sent.items.includes(id)) ?? null;

/**
 * The answer may be lost with the write done. A tramo or a photo that is there
 * must not be sent again; a plain section can: writing it twice changes nothing.
 */
export function landedBefore(save: ReportSave, document: FieldDocument): { itemId: string | null } | null {
  if (!save.sent) return null;
  if (save.sent.seed) return null;
  if (save.createsItem) {
    const itemId = newItemOf(save, document, save.sent);
    return itemId ? { itemId } : null;
  }
  return save.photo && photoListAt(document, save.path).length > save.sent.photos ? { itemId: null } : null;
}

/** Nothing came back (the web says 0, the phone says nothing) or the server is down. */
export const isUnreachable = ({ status }: { status?: number }): boolean => !status || status >= SERVER_DOWN;

/** A failed call: no network or a server down waits, a revoked credential empties the queue (`rn-app-loop` §5), the rest is a refusal the person sees. */
export function judgeFailure(failure: { status?: number; message?: string }): SaveVerdict {
  if (isUnreachable(failure) || UNSENT_HTTP.has(failure.status ?? 0)) return { kind: 'retry' };
  if (failure.status === 401) return { kind: 'flush' };
  return { kind: 'refuse', refusal: { message: failure.message ?? SAVE_REFUSED, errors: {} } };
}

const refusalOf = (errors: Record<string, string>): SaveVerdict => ({ kind: 'refuse', refusal: { message: errors._ ?? Object.values(errors)[0] ?? SAVE_REFUSED, errors } });

export function judgeReply(reply: FormSubmitReply): SaveVerdict {
  if (!reply.ok && reply.code === RATE_LIMITED) return { kind: 'retry', afterMs: reply.retryAfterS ? reply.retryAfterS * MS_PER_S : RATE_LIMIT_WAIT_MS };
  if (!reply.ok) return reply.errors && Object.keys(reply.errors).length ? refusalOf(reply.errors) : judgeFailure(reply);
  if (reply.outcome.outcome === 'failed') return { kind: 'retry' };
  return { kind: reply.outcome.outcome === 'pending' ? 'wait' : 'confirm' };
}

/** The late answer of a slow write. None in time: the next pass looks at the report. */
export function judgeNotice(notice: CommandNotice | null): SaveVerdict {
  if (!notice) return { kind: 'retry' };
  return notice.errors ? refusalOf(notice.errors) : { kind: 'confirm' };
}

/** Portal gave the tramo its id: what hung from the local one follows it, and nothing creates it again. */
export function resolveItem(queue: readonly ReportSave[], localId: string, itemId: string): ReportSave[] {
  return queue.map((one) => {
    if (one.path.itemId !== localId) return one;
    const { createsItem: _made, ...rest } = one;
    return { ...rest, path: { ...one.path, itemId } };
  });
}

/** Discarding a tramo not sent discards what hangs from it. */
export function withoutSave(queue: readonly ReportSave[], clientKey: string): ReportSave[] {
  const gone = queue.find((one) => one.clientKey === clientKey);
  return queue.filter((one) => one.clientKey !== clientKey && !(gone?.createsItem && one.path.itemId === gone.path.itemId));
}

/** What the device adds to a form: what Portal refused, who is filling it and the hours of its clock. */
export type ReportFormContext = { errors?: Record<string, string>; personName?: string | null; arrivalHour?: string; startHour?: string };

/** A section's form, drawn here from the document: it opens with no signal, and what Portal refused goes under its field. */
export function reportFormAnswer(document: FieldDocument, path: SectionPath, context: ReportFormContext = {}): EphemeralAnswer | null {
  const { errors, personName, arrivalHour, startHour } = context;
  const found = sectionFormOf(document, path);
  if (!found) return null;
  const filled = path.key === GENERAL_SECTION ? withDeviceFields(found, personName?.trim()) : found;
  const arrived = arrivalHour ? withHour(filled, arrivalHour) : filled;
  const form = withUnitCaption(startHour ? withStartHour(arrived, startHour) : arrived, document, path);
  return { commandId: `report-${path.sectionId}-${path.itemId ?? 'new'}-${path.key}`, appName: REPORT_KEEPER, command: '', action: form.title, state: 'form', response: { responseType: 'form', form }, ...(errors ? { errors } : {}) };
}

const CAPTION_FIELD = 'descripcion';
const UNIT_TITLE_SEPARATOR = ' · ';
const PHOTO_WORD = /^foto\s+(de(l)?\s+)?/i;

/** «Foto del escantillón» → «Escantillón»: the stage a unit photo is. */
const stageOf = (title: string): string => {
  const stage = title.replace(PHOTO_WORD, '').trim();
  return stage.charAt(0).toUpperCase() + stage.slice(1);
};

/** When each unit reached the paver: the hour of its ingreso photo, or nothing yet. */
function arrivalOrderOf(section: RepeatSection, itemId: string, ingresoKey: string | undefined): number {
  const arrivedAt = (item: RepeatItem): string | null => {
    const ingreso = item.sections.find((one) => one.id === ingresoKey);
    return ingreso ? sectionPhotos(ingreso)[0]?.hour || null : null;
  };
  const arrived = section.items.map((item, index) => ({ id: item.id, at: arrivedAt(item), index })).filter((one) => one.at !== null);
  arrived.sort((a, b) => a.at!.localeCompare(b.at!) || a.index - b.index);
  const rank = arrived.findIndex((one) => one.id === itemId);
  return rank >= 0 ? rank + 1 : arrived.length + 1;
}

/**
 * José 12/11: a unit photo's description says its stage, the unit's order of arrival at the paver
 * and its plate («Ingreso · llegada n.º 2 a descarga · F2K-908»). Only when nothing is written.
 */
function withUnitCaption(form: AppForm, document: FieldDocument, path: SectionPath): AppForm {
  const caption = form.schema.properties?.[CAPTION_FIELD];
  const section = document.sections.find((one) => one.id === path.sectionId);
  if (!caption || caption.default !== undefined || section?.kind !== 'repeat' || !path.itemId) return form;
  const entry = section.template.find((one) => one.id === path.key);
  const item = section.items.find((one) => one.id === path.itemId);
  if (!entry?.photoKind || !item) return form;
  const plate = item.title.split(UNIT_TITLE_SEPARATOR).pop()!.trim();
  const ingresoKey = section.template.find((one) => one.photoKind === 'ingreso')?.id;
  const text = `${stageOf(entry.title)} · llegada n.º ${arrivalOrderOf(section, item.id, ingresoKey)} a descarga · ${plate}`;
  return { ...form, schema: { ...form.schema, properties: { ...form.schema.properties, [CAPTION_FIELD]: { ...caption, default: text } } } };
}

/** The hour the form must say and nobody wrote: its required time field with no value. */
function withHour(form: AppForm, hour: string): AppForm {
  const properties: Record<string, FormSchemaProperty> = { ...form.schema.properties };
  const name = form.schema.required?.find((one) => properties[one]?.format === 'time' && properties[one]?.default === undefined);
  if (!name) return form;
  properties[name] = { ...properties[name], default: hour };
  return { ...form, schema: { ...form.schema, properties } };
}

/** «Hora inicio» starts at the hour of now when nothing was saved (José 06/11); «Hora final» waits for the person. */
function withStartHour(form: AppForm, hour: string): AppForm {
  const properties: Record<string, FormSchemaProperty> = { ...form.schema.properties };
  const name = Object.keys(properties).find((one) => properties[one]?.format === 'time' && START_HOUR.test(String(properties[one]?.title ?? '')) && properties[one]?.default === undefined);
  if (!name) return form;
  properties[name] = { ...properties[name], default: hour };
  return { ...form, schema: { ...form.schema, properties } };
}

/** José, 06/11: the responsible is who makes the report, unless one was saved, and the place can be read from the device. */
function withDeviceFields(form: AppForm, personName?: string): AppForm {
  const properties: Record<string, FormSchemaProperty> = { ...form.schema.properties };
  const member = properties[MEMBER_FIELD];
  const place = properties[PLACE_FIELD];
  if (member && personName && member.default === undefined) properties[MEMBER_FIELD] = { ...member, default: personName };
  if (place) properties[PLACE_FIELD] = { ...place, 'x-input': 'place' };
  return { ...form, schema: { ...form.schema, properties } };
}

/** The line over the hub while something waits. */
export function queueLine(count: number, offline: boolean): string {
  if (count === 0) return 'Sin señal. Lo que guardes sale solo cuando vuelva.';
  const noun = count === 1 ? 'cambio' : 'cambios';
  if (!offline) return `${count} ${noun} enviándose`;
  return `${count} ${noun} sin enviar. ${count === 1 ? 'Sale solo' : 'Salen solos'} cuando vuelva la señal.`;
}
