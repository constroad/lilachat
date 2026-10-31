import type { FormField, FormSchema, FormSchemaProperty, FormValues } from './appForms.js';
import { BLOCK_LIMITS, validateBotBlocks, type BotBlock } from './botBlocks.js';
/**
 * The rich options of an app's form (agentes 2483da7, 30/10: fuel consumption).
 * Agentes resolves the product's `x-options` to `oneOf` with extras that
 * Lilachat draws: a thumbnail and the photos behind it, the row an option
 * belongs to, and options that show but cannot be picked. PURE.
 */

/** An option of a choice; `sub` is the line under it (a person's role, why it is locked). */
export type ChoiceOption = {
  value: string;
  label: string;
  sub?: string;
  /** `x-thumb`: a square picture beside the label (a reading's tape). */
  thumb?: string;
  /** `x-photos`: what the viewer swipes through when the thumbnail is tapped. */
  photos?: string[];
  /** `x-match`: offered only in a list's row whose values equal these (PEN-1's readings in PEN-1's row). */
  match?: Record<string, string>;
  /** `x-disabled`: seen, with its reason in `sub`, but never picked. */
  disabled?: true;
};

export const OPTION_LIMITS = { options: 300, label: 60, photos: 6, url: 500 };
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const line = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const labelOf = (name: string) => name.replace(/[_-]+/g, ' ').replace(/^./, (first) => first.toUpperCase());
const https = (value: unknown): string | undefined => (typeof value === 'string' && value.startsWith('https://') && value.length <= OPTION_LIMITS.url ? value : undefined);

type Pair = { value: string; title: unknown; raw: Record<string, unknown> };

/**
 * `enum` (+ `x-labels`) or `oneOf` with `const`; null when it is neither. An
 * empty `oneOf` is a choice with nothing to pick yet: Test had no orders in the
 * period and the whole consumption form failed as «no pudo responder» (31/10).
 */
function pairsOf(property: FormSchemaProperty): Pair[] | null {
  const labels = record(property['x-labels']);
  if (Array.isArray(property.enum)) return property.enum.map((value) => ({ value: String(value), title: labels[String(value)], raw: {} }));
  if (Array.isArray(property.oneOf) && property.oneOf.length === 0) return [];
  if (!Array.isArray(property.oneOf) || !property.oneOf.some((option) => record(option).const !== undefined)) return null;
  return property.oneOf.map(record).filter((option) => option.const !== undefined).map((option) => ({ value: String(option.const), title: option.title, raw: option }));
}

/** The extras of one `oneOf` entry; anything not https is dropped, never drawn. */
function extrasOf(raw: Record<string, unknown>): Omit<ChoiceOption, 'value' | 'label'> {
  const sub = line(raw.description, OPTION_LIMITS.label);
  const thumb = https(raw['x-thumb']);
  const photos = (Array.isArray(raw['x-photos']) ? raw['x-photos'] : []).map(https).filter((url): url is string => Boolean(url)).slice(0, OPTION_LIMITS.photos);
  const match = Object.fromEntries(Object.entries(record(raw['x-match'])).filter(([, value]) => typeof value === 'string' || typeof value === 'number').map(([key, value]) => [key, String(value)]));
  return { ...(sub ? { sub } : {}), ...(thumb ? { thumb } : {}), ...(photos.length ? { photos } : {}), ...(Object.keys(match).length ? { match } : {}), ...(raw['x-disabled'] === true ? { disabled: true as const } : {}) };
}

/**
 * The options of a choice. A repeated value is kept once: Portal's material
 * list sent one id twice and the sheet drew two rows with the same key (E2E 24/10).
 */
export function choiceOptions(property: FormSchemaProperty): ChoiceOption[] | null {
  const pairs = pairsOf(property);
  if (!pairs) return null;
  const unique = pairs.filter((pair, index) => pairs.findIndex((other) => other.value === pair.value) === index);
  return unique.slice(0, OPTION_LIMITS.options).map((pair) => ({ value: pair.value, label: line(pair.title, OPTION_LIMITS.label) || labelOf(pair.value), ...extrasOf(pair.raw) }));
}

/** The options a list's row offers: those without `match`, and those whose `match` equals the row's values. */
export function optionsForRow(options: readonly ChoiceOption[], row: FormValues): ChoiceOption[] {
  return options.filter((option) => !option.match || Object.entries(option.match).every(([key, value]) => String(row[key] ?? '') === value));
}

/** Why a picked value cannot go: not an option, locked, or not of this row. Null when it can. */
export function refusalOf(options: readonly ChoiceOption[], value: unknown, row?: FormValues): string | null {
  const option = options.find((one) => one.value === value);
  if (!option) return 'Elige entre las opciones.';
  if (option.disabled) return 'Esa opción ya no se puede elegir.';
  return row && optionsForRow([option], row).length === 0 ? 'Esa opción no va en esta fila.' : null;
}

/** A fixed row's title: the label of its `x-row-title` field's option, or the raw value. */
export function rowTitleOf(field: Extract<FormField, { kind: 'list' }>, row: FormValues): string {
  const name = field.rowTitle;
  if (!name) return '';
  const value = String(row[name] ?? '');
  const titled = field.fields.find((one) => one.name === name);
  return (titled?.kind === 'choice' ? titled.options.find((option) => option.value === value)?.label : undefined) ?? value;
}

/** `x-preview: { tool }` at the schema's root: the read tool that sums up the draft before sending. */
export function previewToolOf(schema: FormSchema | undefined): string | undefined {
  const tool = line(record(record(schema)['x-preview']).tool, OPTION_LIMITS.label);
  return tool || undefined;
}

const stillThere = (field: FormField | undefined, value: unknown): boolean => {
  if (field?.kind === 'choice') return field.options.some((option) => option.value === value && !option.disabled);
  return true;
};

/** One value after the options changed: a vanished pick goes, the rest stays. */
function keptValue(field: FormField, value: unknown): unknown {
  if (field.kind === 'choice') return stillThere(field, value) ? value : undefined;
  if (field.kind === 'multi') return Array.isArray(value) ? value.filter((one) => field.options.some((option) => option.value === one && !option.disabled)) : undefined;
  if (field.kind !== 'list' || !Array.isArray(value)) return value;
  const items = value.map((item) => keptItem(field, record(item)));
  return field.fixedRows ? fixedRowsKept(field, items) : items;
}

const keptItem = (field: Extract<FormField, { kind: 'list' }>, item: FormValues): FormValues => Object.fromEntries(Object.entries(item).filter(([name, one]) => stillThere(field.fields.find((child) => child.name === name), one)));

/** The app's new rows (another set of tanks), each with what was picked in the row of the same title. */
function fixedRowsKept(field: Extract<FormField, { kind: 'list' }>, items: FormValues[]): FormValues[] {
  const title = field.rowTitle;
  return (field.initialItems ?? []).map((row) => {
    const same = title ? items.find((item) => String(item[title] ?? '') === String(row[title] ?? '')) : undefined;
    return same ? { ...row, ...same } : row;
  });
}

/**
 * The draft after the app sent the form again for a new period (`x-refresh`):
 * whatever is still offered stays picked, the rest is dropped.
 */
export function keptAfterRefresh(fields: readonly FormField[], values: FormValues): FormValues {
  return Object.fromEntries(fields.flatMap((field) => {
    if (!(field.name in values)) return [];
    const kept = keptValue(field, values[field.name]);
    return kept === undefined ? [] : [[field.name, kept]];
  }));
}

/** What a draft carries to the app: no photos (ids that mean nothing yet) and no place (read only at sending). */
const draftable = (field: FormField): boolean => field.kind !== 'photo' && field.kind !== 'location';

/**
 * The draft that goes to `x-refresh` and `x-preview`: only the form's own
 * answers, each item of a list with its own answers. Not checked: it is a draft.
 */
export function draftValues(fields: readonly FormField[], raw: FormValues): FormValues {
  return Object.fromEntries(fields.filter(draftable).flatMap((field) => {
    const value = raw[field.name];
    if (value === undefined || value === null) return [];
    if (field.kind !== 'list') return [[field.name, value]];
    const items = Array.isArray(value) ? value.map((item) => draftValues(field.fields, record(item))) : [];
    return [[field.name, items]];
  }));
}

export type PreviewReply = { blocks: BotBlock[]; errors: Record<string, string> };

/** The app's summary of the draft: kit blocks above «Enviar» and a line per field; anything else is no summary. */
export function previewReplyOf(raw: unknown): PreviewReply {
  const body = record(raw);
  const checked = validateBotBlocks(Array.isArray(body.blocks) ? body.blocks.slice(0, BLOCK_LIMITS.cardBlocks) : [], BLOCK_LIMITS.cardBlocks);
  const errors = Object.fromEntries(Object.entries(record(body.errors)).flatMap(([path, message]) => (typeof message === 'string' && message.trim() ? [[path, line(message, BLOCK_LIMITS.text)]] : [])));
  return { blocks: checked.ok ? checked.blocks : [], errors };
}
