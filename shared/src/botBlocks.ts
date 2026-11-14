import type { CardTone } from './bots.js';
import type { ViewableFile } from './fileViewer.js';
import { validateWeatherBlock, type WeatherBlock } from './weatherBlock.js';

/**
 * The card kit (§118.4, José 23/10): what an app draws inside its card instead
 * of a wall of text or an image — a figure, chips, a chart, a tank, people,
 * rows, attachments by reference. The app sends data; Lilachat draws it with
 * the theme. PURE: the server validates with this; app and web share the
 * geometry below so a chart looks the same on both.
 */
export type ChartKind = 'bar-h' | 'bar-v' | 'line';
export type ChartPoint = { label: string; value: number; display?: string; note?: string; tone: CardTone };
export type TankItemBase = { name: string; level: number; min?: number; value: string; sub?: string; delta?: string; /** The verdict in words («Saludable», «Stock medio», «Bajo»), colored by `tone` (design r155). */ status?: string; tone: CardTone };
/** A tank's detail draws any block, and its own tank without a detail: one level, so it never loops (also for the types). */
export type TankDetailBlock = Exclude<BotBlock, { type: 'tank' }> | { type: 'tank'; items: TankItemBase[] };
/** Tapping the tank opens it (José, 24/10): the big tank, its level, minimum, last reading. */
export type TankItem = TankItemBase & { detail?: { title: string; blocks: TankDetailBlock[] } };
/** What backs a mark, for a command's detail (José, 04/11): the photo and where it was signed. */
export type PersonEvidence = { photo?: string; place?: string; map?: string };
export type BotBlock =
  | { type: 'metric'; value: string; unit?: string; label?: string; tone: CardTone }
  | { type: 'chips'; items: { label: string; sub?: string; tone: CardTone }[] }
  | { type: 'chart'; kind: ChartKind; unit?: string; points: ChartPoint[]; threshold?: { value: number; label?: string }; max?: number }
  | { type: 'progress'; value: number; max: number; label: string; tone: CardTone }
  | { type: 'tank'; items: TankItem[] }
  | { type: 'text'; text: string; tone: CardTone }
  /**
   * `command`: the line a person would type; tapping the row runs it (José, 05/11).
   * `mid`: a muted middle column («24,43 gl/m³»); `before`: the previous value, struck through (Stitch a10).
   */
  | { type: 'rows'; rows: { label: string; value: string; sub?: string; mid?: string; before?: string; bar?: number; tone: CardTone; command?: string; anyone?: boolean }[] }
  /** The inset figure (Stitch a10): a caption on top, the label on the left and the big value on the right. */
  | { type: 'stat'; caption?: string; label: string; value: string; unit?: string }
  /** A section header with a text on the right («Combustible … Consumo total en planta»). */
  | { type: 'section'; title: string; aside?: string }
  /** A grid of label and value (materials): 2 columns. */
  | { type: 'tiles'; items: { label: string; value: string }[] }
  /** `times[i]` is the time of `names[i]`, as the app wrote it; '' when that person has none (José, 04/11). */
  | { type: 'people'; names: string[]; times?: string[]; evidence?: PersonEvidence[]; more?: number }
  | { type: 'attachments'; count: number; label: string; url: string }
  /** Photos and videos shown as thumbnails; a tap opens the viewer (José via agentes, 09/11: each unit's root card in #planta). */
  | { type: 'gallery'; items: GalleryItem[] }
  /** Where something happened, as the chat's location card (José via agentes 09/11: the place of an attendance mark). */
  | { type: 'map'; lat: number; lng: number; label?: string; precisionM?: number; points?: MapRoutePoint[] }
  | WeatherBlock;
/** A point of a route on the map block (Portal 13/11, visits: up to 31, in order, joined by a dotted line). */
export type MapRoutePoint = { lat: number; lng: number; label?: string };
export type GalleryItem = { url: string; thumbUrl?: string; mime: string; name?: string; label?: string };

export const BLOCK_LIMITS = { cardBlocks: 8, detailBlocks: 12, chips: 6, points: 31, tanks: 12, rows: 40, people: 40, label: 40, short: 24, caption: 80, text: 200, url: 500, gallery: 20, tiles: 12, cardBytes: 16_000 };
/** Where a gallery's files may live: a card's thumbnails load on every member's device, so no tracking pixel from anyone else. */
// inframaq.constroad.com (José 13/11): the photos of a material reception, served by Inframaq itself.
const GALLERY_HOSTS: readonly string[] = ['lila.constroad.com', 'www.constroad.com', 'inframaq.constroad.com'];
const GALLERY_STRIP = 4;
const TONES: readonly CardTone[] = ['ok', 'warn', 'error', 'info', 'neutral'];
const KINDS: readonly ChartKind[] = ['bar-h', 'bar-v', 'line'];

type Result<T> = { ok: true; value: T } | { ok: false; message: string };
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const tone = (value: unknown): CardTone => (TONES.includes(value as CardTone) ? (value as CardTone) : 'neutral');
const clamp01 = (value: unknown): number => Math.min(1, Math.max(0, Number(value) || 0));
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const COMMAND_LINE = /^\/[a-zA-Z]/;
/** A line a row or a button of a card may run, or nothing. */
export const commandLineOf = (value: unknown): string | null => {
  const line = text(value, BLOCK_LIMITS.text);
  return COMMAND_LINE.test(line) ? line : null;
};
/** `anyone`: the app opens this row to every member of the channel, whatever «Quién puede usarlo» says. */
const withCommand = (row: Record<string, unknown>): { command?: string; anyone?: true } => {
  const command = commandLineOf(row.command);
  if (!command) return {};
  return row.anyone === true ? { command, anyone: true } : { command };
};
const withText = <K extends string>(key: K, value: unknown, max: number): Partial<Record<K, string>> => {
  const clean = text(value, max);
  return clean ? ({ [key]: clean } as Record<K, string>) : {};
};

/**
 * Too long is cut at the last whole word, without «…» (Stitch a10: no text of a card is cut
 * with «…» nor broken mid-word). A single word longer than `max` is cut hard.
 */
export function upToWord(value: unknown, max: number): string {
  const clean = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (clean.length <= max) return clean;
  const lastSpace = clean.slice(0, max + 1).lastIndexOf(' ');
  return (lastSpace > 0 ? clean.slice(0, lastSpace) : clean.slice(0, max)).replace(/[\s,;:.·\-–—]+$/, '');
}
/** A text that is a figure («268,00 m³», «−6,08 gl»): a section's aside then reads as a total, not a note. */
export const isFigure = (value: string): boolean => /^[−–+-]?\d/.test(value.trim());
const withWords = <K extends string>(key: K, value: unknown, max: number): Partial<Record<K, string>> => {
  const clean = upToWord(value, max);
  return clean ? ({ [key]: clean } as Record<K, string>) : {};
};

function chartBlock(raw: Record<string, unknown>): Result<BotBlock> {
  if (!KINDS.includes(raw.kind as ChartKind)) return { ok: false, message: `El gráfico es uno de: ${KINDS.join(', ')}.` };
  const points: ChartPoint[] = [];
  for (const item of list(raw.points, BLOCK_LIMITS.points)) {
    const point = record(item);
    const value = finite(point.value);
    if (value === null) return { ok: false, message: 'Cada punto del gráfico necesita un valor numérico.' };
    points.push({ label: text(point.label, BLOCK_LIMITS.label), value, ...withText('display', point.display, BLOCK_LIMITS.short), ...withText('note', point.note, BLOCK_LIMITS.short), tone: tone(point.tone) });
  }
  if (points.length === 0) return { ok: false, message: 'El gráfico necesita al menos un punto.' };
  const threshold = finite(record(raw.threshold).value);
  const max = finite(raw.max);
  return { ok: true, value: { type: 'chart', kind: raw.kind as ChartKind, ...withText('unit', raw.unit, BLOCK_LIMITS.short), points, ...(threshold !== null ? { threshold: { value: threshold, ...withText('label', record(raw.threshold).label, BLOCK_LIMITS.short) } } : {}), ...(max !== null && max > 0 ? { max } : {}) } };
}

/** A tank's own detail; inside it a tank opens nothing more (one level, never a loop). */
function tankDetail(raw: unknown, name: string): Pick<TankItem, 'detail'> {
  const detail = record(raw);
  const checked = validateBotBlocks(detail.blocks, BLOCK_LIMITS.detailBlocks);
  if (!checked.ok || !checked.blocks.length) return {};
  const blocks: TankDetailBlock[] = checked.blocks.map((one) => (one.type === 'tank' ? { type: 'tank' as const, items: one.items.map(({ detail: _nested, ...tank }) => tank) } : one));
  return { detail: { title: text(detail.title, BLOCK_LIMITS.label) || name, blocks } };
}

function tankBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const items: TankItem[] = list(raw.items, BLOCK_LIMITS.tanks).map((item) => {
    const tank = record(item);
    const name = text(tank.name, BLOCK_LIMITS.label);
    return { name, level: clamp01(tank.level), ...(tank.min !== undefined ? { min: clamp01(tank.min) } : {}), value: text(tank.value, BLOCK_LIMITS.short), ...withText('sub', tank.sub, BLOCK_LIMITS.label), ...withText('delta', tank.delta, BLOCK_LIMITS.short), ...withText('status', tank.status, BLOCK_LIMITS.short), tone: tone(tank.tone), ...(tank.detail ? tankDetail(tank.detail, name) : {}) };
  }).filter((tank) => tank.name);
  return items.length ? { ok: true, value: { type: 'tank', items } } : { ok: false, message: 'El tanque necesita nombre.' };
}

function attachmentsBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const url = text(raw.url, BLOCK_LIMITS.url);
  if (!url.startsWith('https://')) return { ok: false, message: 'Los adjuntos se abren por un enlace https://.' };
  const count = Math.max(1, Math.floor(Number(raw.count) || 1));
  return { ok: true, value: { type: 'attachments', count, label: text(raw.label, BLOCK_LIMITS.short) || (count === 1 ? '1 adjunto' : `${count} adjuntos`), url } };
}

const httpsLink = (value: unknown): string => {
  const clean = text(value, BLOCK_LIMITS.url);
  return clean.startsWith('https://') ? clean : '';
};

const galleryLink = (value: unknown): string => {
  const link = httpsLink(value);
  try {
    return link && GALLERY_HOSTS.includes(new URL(link).hostname) ? link : '';
  } catch {
    return '';
  }
};

const MAX_LAT = 90;
const MAX_LNG = 180;

const onThePlanet = (lat: number | null, lng: number | null): boolean => lat !== null && lng !== null && Math.abs(lat) <= MAX_LAT && Math.abs(lng) <= MAX_LNG;

/** The route's points that are on the planet, in order; a bad one is dropped, not the whole map. */
function routePointsOf(raw: unknown): MapRoutePoint[] {
  return list(raw, BLOCK_LIMITS.points).flatMap((item) => {
    const point = record(item);
    const [lat, lng] = [finite(point.lat), finite(point.lng)];
    return lat !== null && lng !== null && onThePlanet(lat, lng) ? [{ lat, lng, ...withText('label', point.label, BLOCK_LIMITS.label) }] : [];
  });
}

function mapBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const points = routePointsOf(raw.points);
  // A route also carries a place (its first point): a phone without the route draws that one.
  const [lat, lng] = [finite(raw.lat) ?? points[0]?.lat ?? null, finite(raw.lng) ?? points[0]?.lng ?? null];
  if (lat === null || lng === null || !onThePlanet(lat, lng)) return { ok: false, message: 'El mapa necesita lat y lng válidos.' };
  const precision = finite(raw.precision_m ?? raw.precisionM);
  return { ok: true, value: { type: 'map', lat, lng, ...withText('label', raw.label, BLOCK_LIMITS.label), ...(precision !== null && precision >= 0 ? { precisionM: Math.round(precision) } : {}), ...(points.length > 1 ? { points } : {}) } };
}

function galleryItemOf(raw: unknown): GalleryItem | null {
  const sent = record(raw);
  const url = galleryLink(sent.url);
  const mime = text(sent.mime, BLOCK_LIMITS.short).toLowerCase();
  if (!url || !(mime.startsWith('image/') || mime.startsWith('video/'))) return null;
  const thumbUrl = galleryLink(sent.thumb_url ?? sent.thumbUrl);
  return { url, ...(thumbUrl ? { thumbUrl } : {}), mime, ...withText('name', sent.name, BLOCK_LIMITS.label), ...withText('label', sent.label, BLOCK_LIMITS.short) };
}

/** A bot message's own files (`files`): the gallery's rules, up to 20. */
export function validateBotFiles(raw: unknown): { ok: true; files: GalleryItem[] } | { ok: false; message: string } {
  const sent = Array.isArray(raw) ? raw : [];
  const files = sent.map(galleryItemOf).filter((one): one is GalleryItem => one !== null).slice(0, BLOCK_LIMITS.gallery);
  return files.length ? { ok: true, files } : { ok: false, message: 'files necesita fotos o videos https de Constroad.' };
}

function galleryBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const sent = Array.isArray(raw.items) ? raw.items : [];
  const items = sent.map(galleryItemOf).filter((one): one is GalleryItem => one !== null).slice(0, BLOCK_LIMITS.gallery);
  return items.length ? { ok: true, value: { type: 'gallery', items } } : { ok: false, message: 'La galería necesita fotos o videos https de Constroad.' };
}

/** The gallery's files as the viewer takes them; the label shows as the file's line. */
export const galleryFiles = (block: Extract<BotBlock, { type: 'gallery' }>): ViewableFile[] =>
  block.items.map((one) => ({ url: one.url, ...(one.thumbUrl ? { thumbUrl: one.thumbUrl } : {}), mime: one.mime, name: one.name ?? (one.mime.startsWith('video/') ? 'Video' : 'Foto'), ...(one.label ? { when: one.label } : {}) }));

/** How many thumbnails the card draws and how many the «+N» counts. */
export const galleryStrip = (count: number): { shown: number; more: number } => ({ shown: Math.min(count, GALLERY_STRIP), more: Math.max(0, count - GALLERY_STRIP) });

function evidenceOf(raw: unknown): PersonEvidence {
  const sent = record(raw);
  const photo = httpsLink(sent.photo);
  const map = httpsLink(sent.map);
  return { ...(photo ? { photo } : {}), ...withText('place', sent.place, BLOCK_LIMITS.label), ...(map ? { map } : {}) };
}

/** A blank name goes with its time and its evidence: each one stays with its person. */
function peopleBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const sentTimes = Array.isArray(raw.times) ? raw.times : [];
  const sentEvidence = Array.isArray(raw.evidence) ? raw.evidence : [];
  const people = list(raw.names, BLOCK_LIMITS.people)
    .map((name, index) => ({ name: text(name, BLOCK_LIMITS.label), time: text(sentTimes[index], BLOCK_LIMITS.short), evidence: evidenceOf(sentEvidence[index]) }))
    .filter((person) => person.name);
  const times = people.map((person) => person.time);
  const evidence = people.map((person) => person.evidence);
  return {
    ok: true,
    value: {
      type: 'people',
      names: people.map((person) => person.name),
      ...(times.some(Boolean) ? { times } : {}),
      ...(evidence.some((one) => Object.keys(one).length) ? { evidence } : {}),
      ...(Number(raw.more) > 0 ? { more: Math.floor(Number(raw.more)) } : {}),
    },
  };
}

function rowOf(item: unknown): Extract<BotBlock, { type: 'rows' }>['rows'][number] {
  const row = record(item);
  return {
    label: text(row.label, BLOCK_LIMITS.label),
    value: text(row.value, BLOCK_LIMITS.text),
    ...withText('sub', row.sub, BLOCK_LIMITS.text),
    ...withWords('mid', row.mid, BLOCK_LIMITS.short),
    ...withWords('before', row.before, BLOCK_LIMITS.short),
    ...(row.bar !== undefined ? { bar: clamp01(row.bar) } : {}),
    tone: tone(row.tone),
    ...withCommand(row),
  };
}

function statBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const label = upToWord(raw.label, BLOCK_LIMITS.label);
  const value = upToWord(raw.value, BLOCK_LIMITS.short);
  if (!label || !value) return { ok: false, message: 'La cifra necesita etiqueta y valor.' };
  return { ok: true, value: { type: 'stat', ...withWords('caption', raw.caption, BLOCK_LIMITS.caption), label, value, ...withWords('unit', raw.unit, BLOCK_LIMITS.short) } };
}

function sectionBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const title = upToWord(raw.title, BLOCK_LIMITS.label);
  return title ? { ok: true, value: { type: 'section', title, ...withWords('aside', raw.aside, BLOCK_LIMITS.label) } } : { ok: false, message: 'La sección necesita un título.' };
}

function tilesBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const items = list(raw.items, BLOCK_LIMITS.tiles)
    .map((item) => ({ label: upToWord(record(item).label, BLOCK_LIMITS.label), value: upToWord(record(item).value, BLOCK_LIMITS.short) }))
    .filter((tile) => tile.label && tile.value);
  return items.length ? { ok: true, value: { type: 'tiles', items } } : { ok: false, message: 'Las casillas necesitan etiqueta y valor.' };
}

/** One block as the server keeps it, or null for an unknown type (ignored, not an error: newer apps may send more). */
function block(raw: Record<string, unknown>): Result<BotBlock> | null {
  switch (raw.type) {
    case 'metric': return text(raw.value, BLOCK_LIMITS.short) ? { ok: true, value: { type: 'metric', value: text(raw.value, BLOCK_LIMITS.short), ...withText('unit', raw.unit, BLOCK_LIMITS.short), ...withText('label', raw.label, BLOCK_LIMITS.label), tone: tone(raw.tone) } } : { ok: false, message: 'La cifra necesita un valor.' };
    case 'chips': return { ok: true, value: { type: 'chips', items: list(raw.items, BLOCK_LIMITS.chips).map((item) => ({ label: text(record(item).label, BLOCK_LIMITS.short), ...withText('sub', record(item).sub, BLOCK_LIMITS.short), tone: tone(record(item).tone) })).filter((chip) => chip.label) } };
    case 'chart': return chartBlock(raw);
    case 'progress': {
      const max = Math.max(1, finite(raw.max) ?? 1);
      return { ok: true, value: { type: 'progress', value: Math.min(max, Math.max(0, finite(raw.value) ?? 0)), max, label: text(raw.label, BLOCK_LIMITS.label), tone: tone(raw.tone) } };
    }
    case 'tank': return tankBlock(raw);
    case 'text': return text(raw.text, BLOCK_LIMITS.text) ? { ok: true, value: { type: 'text', text: text(raw.text, BLOCK_LIMITS.text), tone: tone(raw.tone) } } : { ok: false, message: 'El texto del bloque está vacío.' };
    case 'rows': return { ok: true, value: { type: 'rows', rows: list(raw.rows, BLOCK_LIMITS.rows).map(rowOf).filter((row) => row.label) } };
    case 'stat': return statBlock(raw);
    case 'section': return sectionBlock(raw);
    case 'tiles': return tilesBlock(raw);
    case 'people': return peopleBlock(raw);
    case 'attachments': return attachmentsBlock(raw);
    case 'gallery': return galleryBlock(raw);
    case 'map': return mapBlock(raw);
    case 'weather': return validateWeatherBlock(raw);
    default: return null;
  }
}

export function validateBotBlocks(raw: unknown, max: number): { ok: true; blocks: BotBlock[] } | { ok: false; message: string } {
  const items = Array.isArray(raw) ? raw : [];
  if (items.length > max) return { ok: false, message: `La tarjeta lleva hasta ${max} bloques.` };
  const blocks: BotBlock[] = [];
  for (const item of items) {
    const result = block(record(item));
    if (!result) continue;
    if (!result.ok) return result;
    blocks.push(result.value);
  }
  return { ok: true, blocks };
}

/** Each bar as a fraction of the longest one (or of `max`), 0 when everything is 0. */
export function barFractions(points: readonly { value: number }[], max?: number): number[] {
  const top = max ?? Math.max(0, ...points.map((point) => point.value));
  return points.map((point) => (top > 0 ? Math.max(0, point.value) / top : 0));
}

/** The narrowest column a vertical bar keeps its value and «Sá 27» legible in (px). */
export const BAR_V_MIN_COLUMN = 40;
const BAR_V_SCROLL_COLUMN = 48;
const BAR_V_MAX_BAR = 32;
const BAR_SHARE = 0.6;

/**
 * Vertical bars in `width` (José, 23/10: seven days at a fixed 56 px cut the
 * last ones on a phone). They share the width while each keeps
 * `BAR_V_MIN_COLUMN`; more than that (a month) scrolls sideways.
 */
export function barColumns(width: number, count: number): { column: number; bar: number; scroll: boolean } {
  if (count <= 0) return { column: 0, bar: 0, scroll: false };
  if (width <= 0) return { column: BAR_V_MIN_COLUMN, bar: BAR_V_MAX_BAR, scroll: false };
  const shared = width / count;
  const column = shared >= BAR_V_MIN_COLUMN ? shared : BAR_V_SCROLL_COLUMN;
  return { column, bar: Math.min(BAR_V_MAX_BAR, Math.round(column * BAR_SHARE)), scroll: shared < BAR_V_MIN_COLUMN };
}

/** An SVG path for a line chart in a `width × height` box: the highest value at the top. */
export function linePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 1) return `M0,${height / 2} L${width},${height / 2}`;
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const span = top - bottom || 1;
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'}${Math.round((index / (values.length - 1)) * width)},${Math.round(((top - value) / span) * height)}`).join(' ');
}

type CardWithLines = { blocks?: readonly BotBlock[]; detail?: { blocks: readonly BotBlock[] }; actions?: readonly { command?: string }[] };

const rowsOf = (card: CardWithLines) => [...(card.blocks ?? []), ...(card.detail?.blocks ?? [])].flatMap((one) => (one.type === 'rows' ? one.rows : []));

/** The lines a card's rows and buttons run, on it and in its detail: the only ones a tap may run. */
export const cardCommandsOf = (card: CardWithLines): string[] => [...rowsOf(card), ...(card.actions ?? [])].flatMap((one) => (one.command ? [one.command] : []));

/** A row the app opened to every member of the channel; a button never is. */
export const rowIsForAnyone = (card: CardWithLines, line: string): boolean => rowsOf(card).some((row) => row.command === line && row.anyone === true);

type PeopleBlock = Extract<BotBlock, { type: 'people' }>;
/** A card stops here; its detail lists everybody. */
export const PEOPLE_ON_CARD = 8;

export function peopleOnCard(block: Pick<PeopleBlock, 'names' | 'more'>): { names: string[]; more: number } {
  return { names: block.names.slice(0, PEOPLE_ON_CARD), more: (block.more ?? 0) + Math.max(0, block.names.length - PEOPLE_ON_CARD) };
}

/** The time of the person at `index`; '' when the app did not send one. */
export const personTime = (block: Pick<PeopleBlock, 'times'>, index: number): string => block.times?.[index] ?? '';

/** The photo and the place of the person at `index`; empty when the app sent none. */
export const personEvidence = (block: Pick<PeopleBlock, 'evidence'>, index: number): PersonEvidence => block.evidence?.[index] ?? {};

/** Those with a photo, as the viewer swipes through them. */
export function peoplePhotos(block: Pick<PeopleBlock, 'names' | 'evidence'>): ViewableFile[] {
  return block.names.flatMap((name, index) => {
    const url = personEvidence(block, index).photo;
    return url ? [{ url, name: `Foto de ${name}`, mime: 'image/jpeg' }] : [];
  });
}

/** The liquid inside a tank of `height`: where it starts and how tall it is. */
export function tankFill(level: number, height: number): { y: number; height: number } {
  const filled = Math.round(Math.min(1, Math.max(0, level)) * height);
  return { y: height - filled, height: filled };
}

/** Which way a tank went, by the sign the app wrote: «−6,08 gl», «+12 gl». */
export function tankDeltaTrend(delta: string): 'down' | 'up' | null {
  if (/^[-−–]/.test(delta)) return 'down';
  return delta.startsWith('+') ? 'up' : null;
}

/** The fill of a tank as the design writes it next to the level: «80 %». */
export const tankPercent = (level: number): string => `${Math.round(clamp01(level) * 100)} %`;
