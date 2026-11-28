/**
 * A free color for a work, beyond the palette (José 27/11 asked for a real picker). Hue 0–360,
 * saturation and value 0–1.
 */
export type Hsv = { h: number; s: number; v: number };

const HEX = /^#([0-9a-f]{6})$/i;
const DEGREES = 360;
const SECTOR = 60;
const BYTE = 255;

const toByte = (unit: number): string => Math.round(Math.min(1, Math.max(0, unit)) * BYTE).toString(16).padStart(2, '0');

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % DEGREES) + DEGREES) % DEGREES;
  const chroma = v * s;
  const side = chroma * (1 - Math.abs(((hue / SECTOR) % 2) - 1));
  const base = v - chroma;
  const sector = Math.floor(hue / SECTOR);
  const sectors: Array<[number, number, number]> = [[chroma, side, 0], [side, chroma, 0], [0, chroma, side], [0, side, chroma], [side, 0, chroma], [chroma, 0, side]];
  const [r, g, b] = sectors[sector] ?? [0, 0, 0];
  return `#${toByte(r + base)}${toByte(g + base)}${toByte(b + base)}`;
}

export function hexToHsv(hex: string): Hsv | null {
  const match = HEX.exec(hex);
  if (!match) return null;
  const value = parseInt(match[1] ?? '', 16);
  const [r, g, b] = [((value >> 16) & BYTE) / BYTE, ((value >> 8) & BYTE) / BYTE, (value & BYTE) / BYTE];
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const delta = max - min;
  const raw = delta === 0 ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: ((raw * SECTOR) + DEGREES) % DEGREES, s: max === 0 ? 0 : delta / max, v: max };
}

/** Where a finger is along a box, as 0..1. */
export const unitAt = (offset: number, size: number): number => (size > 0 ? Math.min(1, Math.max(0, offset / size)) : 0);
