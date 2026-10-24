import type { CardTone } from './bots.js';

/**
 * The weather block (pending 96, design e-33; José, 23/10: like Google's,
 * by hours). The app sends numbers; Lilachat draws the now, a curve
 * per hour with Temperatura · Precipitaciones · Viento, and a strip of days
 * where tapping one moves the curve to it. Contract agreed with agentes on
 * 24/10 (`specs/BOTS-API.spec.md` §c-decies). PURE: validation and geometry.
 */
export const WEATHER_ICONS = ['sun', 'partly', 'cloud', 'rain', 'storm', 'fog'] as const;
export type WeatherIcon = (typeof WEATHER_ICONS)[number];
export type WeatherSeries = 'temp' | 'rain' | 'wind';
export type WeatherHour = { at: string; temp?: number; rain?: number; mm?: number; wind?: number };
export type WeatherDay = {
  label: string;
  icon: WeatherIcon;
  max?: number;
  min?: number;
  /** The temperature of now: only today. */
  temp?: number;
  summary?: string;
  rain?: number;
  mm?: number;
  humidity?: number;
  wind?: number;
  /** «Riesgo alto para asfaltar», what /clima exists for. */
  risk?: { label: string; tone: CardTone };
  /** «Tendencia» for a far day sent without hours. */
  note?: string;
  hours: WeatherHour[];
};
export type WeatherBlock = { type: 'weather'; place?: string; days: WeatherDay[] };

export const WEATHER_LIMITS = { days: 8, hours: 12, label: 12, at: 5, summary: 40, place: 40, risk: 40, note: 24 };
const RISK_TONES: readonly CardTone[] = ['ok', 'warn', 'error'];
const AT = /^([01]\d|2[0-3]):[0-5]\d$/;

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const finite = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const percent = (value: unknown): number | undefined => {
  const number = finite(value);
  return number === undefined ? undefined : Math.min(100, Math.max(0, number));
};
const atLeastZero = (value: unknown): number | undefined => {
  const number = finite(value);
  return number === undefined ? undefined : Math.max(0, number);
};
/** Only the numbers that came: a missing one is not drawn, it never becomes 0. */
const numbers = (entries: Record<string, number | undefined>): Record<string, number> => Object.fromEntries(Object.entries(entries).filter((entry): entry is [string, number] => entry[1] !== undefined));

function hourOf(raw: unknown): WeatherHour | null {
  const hour = record(raw);
  const at = text(hour.at, WEATHER_LIMITS.at);
  if (!AT.test(at)) return null;
  return { at, ...numbers({ temp: finite(hour.temp), rain: percent(hour.rain), mm: atLeastZero(hour.mm), wind: atLeastZero(hour.wind) }) };
}

function riskOf(raw: unknown): WeatherDay['risk'] | undefined {
  const risk = record(raw);
  const label = text(risk.label, WEATHER_LIMITS.risk);
  return label ? { label, tone: RISK_TONES.includes(risk.tone as CardTone) ? (risk.tone as CardTone) : 'warn' } : undefined;
}

function dayOf(raw: unknown, index: number): WeatherDay | null {
  const day = record(raw);
  const label = text(day.label, WEATHER_LIMITS.label);
  if (!label) return null;
  const hours = (Array.isArray(day.hours) ? day.hours.slice(0, WEATHER_LIMITS.hours) : []).map(hourOf).filter((hour): hour is WeatherHour => hour !== null);
  const summary = text(day.summary, WEATHER_LIMITS.summary);
  const note = text(day.note, WEATHER_LIMITS.note);
  const risk = riskOf(day.risk);
  return {
    label,
    icon: (WEATHER_ICONS as readonly string[]).includes(day.icon as string) ? (day.icon as WeatherIcon) : 'cloud',
    ...numbers({ max: finite(day.max), min: finite(day.min), ...(index === 0 ? { temp: finite(day.temp) } : {}), rain: percent(day.rain), mm: atLeastZero(day.mm), humidity: percent(day.humidity), wind: atLeastZero(day.wind) }),
    ...(summary ? { summary } : {}),
    ...(risk ? { risk } : {}),
    ...(note ? { note } : {}),
    hours,
  };
}

export function validateWeatherBlock(raw: Record<string, unknown>): { ok: true; value: WeatherBlock } | { ok: false; message: string } {
  const days = (Array.isArray(raw.days) ? raw.days.slice(0, WEATHER_LIMITS.days) : []).map(dayOf).filter((day): day is WeatherDay => day !== null);
  if (!days.length) return { ok: false, message: 'El clima necesita al menos un día con «label».' };
  const place = text(raw.place, WEATHER_LIMITS.place);
  return { ok: true, value: { type: 'weather', ...(place ? { place } : {}), days } };
}

/** The big number of the chosen day: now's temperature, or its maximum. */
export const dayTemperature = (day: WeatherDay): number | undefined => day.temp ?? day.max;

/** «15:00» → «3 p. m.», as the curve labels the hours. */
export function hourLabel(at: string): string {
  const hour = Number(at.slice(0, 2));
  const minutes = at.slice(3, 5);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${minutes === '00' ? '' : `:${minutes}`} ${hour < 12 ? 'a. m.' : 'p. m.'}`;
}

/** The value over each point of a series; a missing one is null. */
export function seriesValue(hour: WeatherHour, series: WeatherSeries): number | null {
  const value = series === 'temp' ? hour.temp : series === 'rain' ? hour.rain : hour.wind;
  return value === undefined ? null : value;
}

/** What is written over a point: «22°», «40 %» or «3,2 mm» when it rains, «12». */
export function pointLabel(hour: WeatherHour, series: WeatherSeries): string {
  const value = seriesValue(hour, series);
  if (value === null) return '';
  if (series === 'temp') return `${Math.round(value)}°`;
  if (series === 'wind') return String(Math.round(value));
  return hour.mm ? `${formatMm(hour.mm)} mm` : `${Math.round(value)} %`;
}

export const formatMm = (mm: number): string => (Math.round(mm * 10) / 10).toString().replace('.', ',');

export type CurvePoint = { x: number; y: number; value: number; index: number };

/**
 * The curve of a series in a `width × height` box, with `pad` on top for the
 * labels. Rain and wind start at 0 (40 % must look like 40 %); temperature
 * fits its own range. Missing values are skipped, the line joins the rest.
 */
export function weatherCurve(hours: readonly WeatherHour[], series: WeatherSeries, width: number, height: number, pad: number): { points: CurvePoint[]; line: string; area: string } {
  const present = hours.map((hour, index) => ({ index, value: seriesValue(hour, series) })).filter((entry): entry is { index: number; value: number } => entry.value !== null);
  if (!present.length || width <= 0 || height <= pad) return { points: [], line: '', area: '' };
  const values = present.map((entry) => entry.value);
  const top = Math.max(...values, series === 'temp' ? -Infinity : 1);
  const bottom = series === 'temp' ? Math.min(...values) : 0;
  const span = top - bottom || 1;
  const step = hours.length > 1 ? width / (hours.length - 1) : 0;
  const usable = height - pad;
  const points = present.map((entry) => ({ index: entry.index, value: entry.value, x: Math.round(hours.length > 1 ? entry.index * step : width / 2), y: Math.round(pad + ((top - entry.value) / span) * usable) }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const area = `${line} L${last.x},${height} L${first.x},${height} Z`;
  return { points, line, area };
}

/** The three lines on the right of the now, only with the numbers that came. */
export function weatherFacts(day: WeatherDay): { label: string; value: string }[] {
  return [
    day.rain !== undefined ? { label: 'Prob. de precipitaciones', value: `${Math.round(day.rain)} %${day.mm ? ` · ${formatMm(day.mm)} mm` : ''}` } : null,
    day.humidity !== undefined ? { label: 'Humedad', value: `${Math.round(day.humidity)} %` } : null,
    day.wind !== undefined ? { label: 'Viento', value: `${Math.round(day.wind)} km/h` } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);
}
