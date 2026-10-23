import type { CardTone } from './bots.js';

/**
 * The card kit (§118.4, José 23/10): what an app draws inside its card instead
 * of a wall of text or an image — a figure, chips, a chart, a tank, people,
 * rows, attachments by reference. The app sends data; Lilachat draws it with
 * the theme. PURE: the server validates with this; app and web share the
 * geometry below so a chart looks the same on both.
 */
export type ChartKind = 'bar-h' | 'bar-v' | 'line';
export type ChartPoint = { label: string; value: number; display?: string; note?: string; tone: CardTone };
export type TankItem = { name: string; level: number; min?: number; value: string; sub?: string; delta?: string; tone: CardTone };
export type BotBlock =
  | { type: 'metric'; value: string; unit?: string; label?: string; tone: CardTone }
  | { type: 'chips'; items: { label: string; sub?: string; tone: CardTone }[] }
  | { type: 'chart'; kind: ChartKind; unit?: string; points: ChartPoint[]; threshold?: { value: number; label?: string }; max?: number }
  | { type: 'progress'; value: number; max: number; label: string; tone: CardTone }
  | { type: 'tank'; items: TankItem[] }
  | { type: 'text'; text: string; tone: CardTone }
  | { type: 'rows'; rows: { label: string; value: string; sub?: string; bar?: number; tone: CardTone }[] }
  | { type: 'people'; names: string[]; more?: number }
  | { type: 'attachments'; count: number; label: string; url: string };

export const BLOCK_LIMITS = { cardBlocks: 8, detailBlocks: 12, chips: 6, points: 31, tanks: 12, rows: 40, people: 8, label: 40, short: 24, text: 200, url: 500, cardBytes: 16_000 };
const TONES: readonly CardTone[] = ['ok', 'warn', 'error', 'info', 'neutral'];
const KINDS: readonly ChartKind[] = ['bar-h', 'bar-v', 'line'];

type Result<T> = { ok: true; value: T } | { ok: false; message: string };
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const tone = (value: unknown): CardTone => (TONES.includes(value as CardTone) ? (value as CardTone) : 'neutral');
const clamp01 = (value: unknown): number => Math.min(1, Math.max(0, Number(value) || 0));
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const withText = <K extends string>(key: K, value: unknown, max: number): Partial<Record<K, string>> => {
  const clean = text(value, max);
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

function tankBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const items: TankItem[] = list(raw.items, BLOCK_LIMITS.tanks).map((item) => {
    const tank = record(item);
    return { name: text(tank.name, BLOCK_LIMITS.label), level: clamp01(tank.level), ...(tank.min !== undefined ? { min: clamp01(tank.min) } : {}), value: text(tank.value, BLOCK_LIMITS.short), ...withText('sub', tank.sub, BLOCK_LIMITS.label), ...withText('delta', tank.delta, BLOCK_LIMITS.short), tone: tone(tank.tone) };
  }).filter((tank) => tank.name);
  return items.length ? { ok: true, value: { type: 'tank', items } } : { ok: false, message: 'El tanque necesita nombre.' };
}

function attachmentsBlock(raw: Record<string, unknown>): Result<BotBlock> {
  const url = text(raw.url, BLOCK_LIMITS.url);
  if (!url.startsWith('https://')) return { ok: false, message: 'Los adjuntos se abren por un enlace https://.' };
  const count = Math.max(1, Math.floor(Number(raw.count) || 1));
  return { ok: true, value: { type: 'attachments', count, label: text(raw.label, BLOCK_LIMITS.short) || (count === 1 ? '1 adjunto' : `${count} adjuntos`), url } };
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
    case 'rows': return { ok: true, value: { type: 'rows', rows: list(raw.rows, BLOCK_LIMITS.rows).map((item) => { const row = record(item); return { label: text(row.label, BLOCK_LIMITS.label), value: text(row.value, BLOCK_LIMITS.text), ...withText('sub', row.sub, BLOCK_LIMITS.text), ...(row.bar !== undefined ? { bar: clamp01(row.bar) } : {}), tone: tone(row.tone) }; }).filter((row) => row.label) } };
    case 'people': return { ok: true, value: { type: 'people', names: list(raw.names, BLOCK_LIMITS.people).map((name) => text(name, BLOCK_LIMITS.label)).filter(Boolean), ...(Number(raw.more) > 0 ? { more: Math.floor(Number(raw.more)) } : {}) } };
    case 'attachments': return attachmentsBlock(raw);
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

/** An SVG path for a line chart in a `width × height` box: the highest value at the top. */
export function linePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 1) return `M0,${height / 2} L${width},${height / 2}`;
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const span = top - bottom || 1;
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'}${Math.round((index / (values.length - 1)) * width)},${Math.round(((top - value) / span) * height)}`).join(' ');
}

/** The liquid inside a tank of `height`: where it starts and how tall it is. */
export function tankFill(level: number, height: number): { y: number; height: number } {
  const filled = Math.round(Math.min(1, Math.max(0, level)) * height);
  return { y: height - filled, height: filled };
}
