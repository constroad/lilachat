import { shrinkPhotoBuffer, type ShrunkPhoto } from '../photoShrink.js';

/** The band takes this share of the height, and the text this share of the width (readable on a phone). */
const BAND_SHARE = 0.17;
const FONT_SHARE = 0.042;
const MIN_FONT_PX = 12;

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function bandSvg(width: number, height: number, lines: readonly [string, string]): Buffer {
  const font = Math.max(MIN_FONT_PX, Math.round(width * FONT_SHARE));
  const left = Math.round(font * 0.8);
  const rows = lines.map((text, index) => `<text x="${left}" y="${Math.round(height * 0.42 + index * font * 1.3)}" font-family="Helvetica, Arial, sans-serif" font-size="${font}" font-weight="${index === 0 ? 700 : 500}" fill="#ffffff">${escapeXml(text)}</text>`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000000" fill-opacity="0.55"/>${rows.join('')}</svg>`);
}

/**
 * The date, the hour and the place burned into a form's photo (pending 94,
 * José 23/10): a dark band at the bottom with two lines. The photo is turned
 * upright first (a phone saves it sideways with an EXIF flag) and sized with
 * Portal's ladder, like every photo (28/10). Throws on a file that is not an
 * image; the caller sends it without the stamp.
 */
export async function stampPhoto(bytes: Buffer, lines: readonly [string, string]): Promise<ShrunkPhoto> {
  const overlay = ({ width, height }: { width: number; height: number }) => [{ input: bandSvg(width, Math.max(MIN_FONT_PX * 3, Math.round(height * BAND_SHARE)), lines), gravity: 'south' }];
  const stamped = await shrinkPhotoBuffer({ bytes, mimeType: 'image/jpeg', fileName: 'selfie.jpg' }, { force: true, overlay });
  if (!stamped) throw new Error('No se pudo leer la foto para sellarla.');
  return stamped;
}
