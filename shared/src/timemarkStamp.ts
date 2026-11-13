import type { GeoPoint } from './appForms.js';
import { cutAtWord } from './textCut.js';

/**
 * The stamp of every report photo (José 12/11, like the Timemark app): the hour big, the date and
 * the weekday beside it, then the address and the GPS with its precision. Never the person's name.
 * The camera draws it live and the server burns the same one, so what was seen is what is kept.
 * PURE: the app, the web and the server.
 */
export type Timemark = { hour: string; date: string; weekday: string; address: string | null; coords: string | null };
export type TimemarkLayout = { landscape: boolean; margin: number; hourSize: number; lineSize: number; smallSize: number; logoSize: number; bar: number };

/** Peru has no daylight saving: the hour is UTC minus five, without building an Intl per call (Hermes). */
const LIMA_OFFSET_MS = -5 * 3_600_000;
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ADDRESS_MAX = 60;
const COORD_DECIMALS = 4;
const two = (value: number): string => String(value).padStart(2, '0');

export function timemarkOf(input: { at: Date; point?: GeoPoint | null; place?: string | null }): Timemark {
  const lima = new Date(input.at.getTime() + LIMA_OFFSET_MS);
  const hour = `${two(lima.getUTCHours())}:${two(lima.getUTCMinutes())}`;
  const date = `${two(lima.getUTCDate())}/${two(lima.getUTCMonth() + 1)}/${lima.getUTCFullYear()}`;
  const { point } = input;
  const address = input.place?.trim() ? cutAtWord(input.place.trim(), ADDRESS_MAX) : null;
  // José 12/11: the address is what the client reads; the numbers stand in only where there is none (a road, open land).
  const coords = point && !address ? `${point.lat.toFixed(COORD_DECIMALS)}, ${point.lng.toFixed(COORD_DECIMALS)} · ±${Math.round(point.precision)} m` : null;
  return { hour, date, weekday: WEEKDAYS[lima.getUTCDay()]!, address, coords };
}

/** Shares of the short side: the same stamp whether the photo was taken upright or sideways. */
const HOUR_SHARE = 0.11;
const LINE_SHARE = 0.036;
const SMALL_SHARE = 0.029;
const LOGO_SHARE = 0.1;
const MARGIN_SHARE = 0.04;
const BAR_SHARE = 0.006;

/** Where and how big: bottom left of the frame, sized by its short side (design cam-01, cam-02). */
export function timemarkLayoutOf(width: number, height: number): TimemarkLayout {
  const short = Math.min(width, height);
  const size = (share: number) => Math.max(1, Math.round(short * share));
  return { landscape: width > height, margin: size(MARGIN_SHARE), hourSize: size(HOUR_SHARE), lineSize: size(LINE_SHARE), smallSize: size(SMALL_SHARE), logoSize: size(LOGO_SHARE), bar: size(BAR_SHARE) };
}
