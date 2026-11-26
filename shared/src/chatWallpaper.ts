import { WALLPAPER_GLYPHS } from './chatWallpaperGlyphs.js';

/**
 * The conversation's wallpaper (José 26/11: «el nuestro se ve muy blanco… como Telegram o WhatsApp»; he chose the road
 * works doodles, close together): line drawings of the field, turned and laid in a 256 px tile, behind chats, channels
 * and groups. The web repeats the tile as a background; the APK draws the same tile as an SVG pattern. PURE.
 */
export const WALLPAPER_TILE = 256;
/** From one drawing to the next: with 20 px drawings it leaves ~12 px between them (WhatsApp-like). */
const PITCH = 32;
const GLYPH_SIZE = 20;
const ICON_BOX = 24;
const JITTER = 4;
const MAX_TURN_DEG = 25;
const SEED = 7;
const PARK_MILLER = 16807;
const MODULUS = 2147483647;

/** The two looks (José approved both 26/11): the brand's violet faint on light, a soft lilac on dark. */
export const WALLPAPER_INK = { light: { stroke: '#6b38d4', opacity: 0.13 }, dark: { stroke: '#c4b5fd', opacity: 0.1 } } as const;
export type WallpaperMode = keyof typeof WALLPAPER_INK;

type Placed = { glyph: string; x: number; y: number; turn: number };

/** The same tile every time: a fixed seed, so web and APK draw the same wallpaper. */
function placements(): Placed[] {
  let seed = SEED;
  const random = () => (seed = (seed * PARK_MILLER) % MODULUS) / MODULUS;
  const cells = WALLPAPER_TILE / PITCH;
  const placed: Placed[] = [];
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const glyph = WALLPAPER_GLYPHS[(row * 5 + col * 3) % WALLPAPER_GLYPHS.length]!;
      const x = col * PITCH + (row % 2 ? PITCH / 2 : 0) + (random() - 0.5) * JITTER;
      const y = row * PITCH + (random() - 0.5) * JITTER;
      placed.push({ glyph, x, y, turn: Math.round((random() - 0.5) * 2 * MAX_TURN_DEG) });
    }
  }
  return placed;
}

const SCALE = (GLYPH_SIZE / ICON_BOX).toFixed(3);
const TILE_BODY = placements()
  .map(({ glyph, x, y, turn }) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${turn} ${GLYPH_SIZE / 2} ${GLYPH_SIZE / 2}) scale(${SCALE})">${glyph}</g>`)
  .join('');

const strokeOf = (mode: WallpaperMode) => {
  const ink = WALLPAPER_INK[mode];
  return `fill="none" stroke="${ink.stroke}" stroke-opacity="${ink.opacity}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
};

/** One tile as an SVG document: the web repeats it as `background-image`. */
export function wallpaperTileSvg(mode: WallpaperMode): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WALLPAPER_TILE}" height="${WALLPAPER_TILE}" viewBox="0 0 ${WALLPAPER_TILE} ${WALLPAPER_TILE}"><g ${strokeOf(mode)}>${TILE_BODY}</g></svg>`;
}

/** The tile as a CSS `url(...)` value (the `#` of the colors escaped). */
export const wallpaperCssUrl = (mode: WallpaperMode): string => `url("data:image/svg+xml,${encodeURIComponent(wallpaperTileSvg(mode))}")`;

/** A full-size SVG that repeats the tile over the chat's own color: what the APK draws behind the messages. */
export function wallpaperPatternSvg(mode: WallpaperMode, background: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><pattern id="obra" width="${WALLPAPER_TILE}" height="${WALLPAPER_TILE}" patternUnits="userSpaceOnUse"><g ${strokeOf(mode)}>${TILE_BODY}</g></pattern></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" fill="url(#obra)"/></svg>`;
}
