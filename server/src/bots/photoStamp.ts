import { shrinkPhotoBuffer, type ShrunkPhoto } from '../photoShrink.js';
import { timemarkLayoutOf, timemarkLogoBoxOf, type Timemark } from '@lilachat/shared';

/** The band takes this share of the height, and the text this share of the width (readable on a phone). */
const BAND_SHARE = 0.17;
const FONT_SHARE = 0.042;
const MIN_FONT_PX = 12;
/** The band's share is for this many lines: a single one takes half. */
const FULL_BAND_LINES = 2;

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function bandSvg(width: number, height: number, lines: readonly string[]): Buffer {
  const font = Math.max(MIN_FONT_PX, Math.round(width * FONT_SHARE));
  const left = Math.round(font * 0.8);
  const firstLine = lines.length < FULL_BAND_LINES ? (height + font * 0.7) / 2 : height * 0.42;
  const rows = lines.map((text, index) => `<text x="${left}" y="${Math.round(firstLine + index * font * 1.3)}" font-family="Helvetica, Arial, sans-serif" font-size="${font}" font-weight="${index === 0 ? 700 : 500}" fill="#ffffff">${escapeXml(text)}</text>`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000000" fill-opacity="0.55"/>${rows.join('')}</svg>`);
}

/**
 * The date, the hour and the place burned into a form's photo (pending 94,
 * José 23/10): a dark band at the bottom with one or two lines. The photo is turned
 * upright first (a phone saves it sideways with an EXIF flag) and sized with
 * Portal's ladder, like every photo (28/10). Throws on a file that is not an
 * image; the caller sends it without the stamp.
 */
export async function stampPhoto(bytes: Buffer, lines: readonly string[]): Promise<ShrunkPhoto> {
  const overlay = ({ width, height }: { width: number; height: number }) => [{ input: bandSvg(width, Math.max(MIN_FONT_PX * 3, Math.round((height * BAND_SHARE * lines.length) / FULL_BAND_LINES)), lines), gravity: 'south' }];
  const stamped = await shrinkPhotoBuffer({ bytes, mimeType: 'image/jpeg', fileName: 'selfie.jpg' }, { force: true, overlay });
  if (!stamped) throw new Error('No se pudo leer la foto para sellarla.');
  return stamped;
}

/** The space's logo, ready to sit at the top right of the frame: a PNG as a data URI, or nothing. */
export type StampLogo = { dataUri: string } | null;

/** «07:42» in Helvetica Bold: four digits of 0.556 em and a colon of 0.333 em; the bar goes after it. */
const HOUR_WIDTH_EM = 2.6;
const SHADE_SHARE = 0.42;
const ACCENT = '#8b5cf6';

/** The Timemark-like stamp as an SVG the size of the photo (design cam-01/cam-02): the lines bottom left over a soft shade, the logo top right (José 13/11). */
export function timemarkSvg(width: number, height: number, stamp: Timemark, logo: StampLogo): Buffer {
  const look = timemarkLayoutOf(width, height);
  const lines = [stamp.address, stamp.coords].filter((line): line is string => Boolean(line));
  const left = look.margin;
  const box = timemarkLogoBoxOf(width, height);
  const bottom = height - look.margin;
  const placeHeight = lines.length * look.lineSize * 1.35;
  const hourBase = bottom - placeHeight - look.lineSize * 0.4;
  const barX = left + look.hourSize * HOUR_WIDTH_EM + look.margin / 3;
  const text = (x: number, y: number, size: number, weight: number, body: string, opacity = 1) => `<text x="${Math.round(x)}" y="${Math.round(y)}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="#ffffff" fill-opacity="${opacity}">${escapeXml(body)}</text>`;
  const parts = [
    `<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient><clipPath id="logo"><rect x="${box.x}" y="${box.y}" width="${box.size}" height="${box.size}" rx="${box.radius}"/></clipPath></defs>`,
    `<rect x="0" y="${Math.round(height * (1 - SHADE_SHARE))}" width="${width}" height="${Math.round(height * SHADE_SHARE)}" fill="url(#shade)"/>`,
    text(left, hourBase, look.hourSize, 700, stamp.hour),
    `<rect x="${Math.round(barX)}" y="${Math.round(hourBase - look.hourSize * 0.72)}" width="${look.bar}" height="${Math.round(look.hourSize * 0.72)}" fill="${ACCENT}"/>`,
    text(barX + look.bar * 3, hourBase - look.hourSize * 0.4, look.lineSize, 700, stamp.date),
    text(barX + look.bar * 3, hourBase - look.hourSize * 0.02, look.lineSize, 500, stamp.weekday, 0.85),
    ...lines.map((line, index) => text(left, hourBase + look.lineSize * 1.35 * (index + 1), index === 0 ? look.lineSize : look.smallSize, index === 0 ? 600 : 500, line, index === 0 ? 1 : 0.85)),
    logo ? `<image x="${box.x}" y="${box.y}" width="${box.size}" height="${box.size}" href="${logo.dataUri}" preserveAspectRatio="xMidYMid slice" clip-path="url(#logo)"/>` : '',
  ];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">${parts.join('')}</svg>`);
}

/**
 * The report camera's stamp burned into the photo (José 12/11): the same one the camera showed
 * live, with the logo when its chip was on. Upright first (EXIF), so a photo taken sideways gets
 * it at the bottom left of the sideways frame. Throws on a file that is not an image.
 */
export async function stampTimemark(bytes: Buffer, stamp: Timemark, logo: StampLogo): Promise<ShrunkPhoto> {
  const overlay = ({ width, height }: { width: number; height: number }) => [{ input: timemarkSvg(width, height, stamp, logo), top: 0, left: 0 }];
  const stamped = await shrinkPhotoBuffer({ bytes, mimeType: 'image/jpeg', fileName: 'foto.jpg' }, { force: true, overlay });
  if (!stamped) throw new Error('No se pudo leer la foto para sellarla.');
  return stamped;
}
