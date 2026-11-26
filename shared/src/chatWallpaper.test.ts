import { describe, expect, it } from 'vitest';
import { WALLPAPER_INK, WALLPAPER_TILE, wallpaperCssUrl, wallpaperPatternSvg, wallpaperTileSvg } from './chatWallpaper.js';

const drawings = (svg: string) => (svg.match(/<g transform=/g) ?? []).length;

describe('the chat wallpaper (José 26/11: road works doodles, close together)', () => {
  it('lays 64 drawings in a 256 px tile, the same every time', () => {
    const tile = wallpaperTileSvg('light');
    expect(drawings(tile)).toBe(64);
    expect(tile).toContain(`width="${WALLPAPER_TILE}"`);
    expect(wallpaperTileSvg('light')).toBe(tile);
  });

  it('inks light and dark in their own color, faint', () => {
    expect(wallpaperTileSvg('light')).toContain(`stroke="${WALLPAPER_INK.light.stroke}" stroke-opacity="0.13"`);
    expect(wallpaperTileSvg('dark')).toContain(`stroke="${WALLPAPER_INK.dark.stroke}" stroke-opacity="0.1"`);
    expect(WALLPAPER_INK.light.opacity).toBeLessThan(0.2);
  });

  it('as CSS, the colors\' # are escaped so the url is valid', () => {
    const css = wallpaperCssUrl('dark');
    expect(css.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(css).not.toContain('#');
  });

  it('the APK\'s version repeats the same drawings over the chat\'s own color', () => {
    const full = wallpaperPatternSvg('dark', '#0b1222');
    expect(full).toContain('<pattern id="obra"');
    expect(full).toContain('fill="#0b1222"');
    expect(drawings(full)).toBe(64);
  });
});
