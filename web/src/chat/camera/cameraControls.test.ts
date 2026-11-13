import { describe, expect, it } from 'vitest';
import { activeZoomChip, zoomChipsFor } from './cameraControls';

// José 13/11: the PWA camera (iPhone users) as the APK's: .6x 1x 2x where the browser can.
describe('zoom chips of the web camera', () => {
  it('a browser without zoom shows none (iPhone Safari)', () => {
    expect(zoomChipsFor(null)).toEqual([]);
    expect(zoomChipsFor({ min: 1, max: 1 })).toEqual([]);
  });

  it('a phone with a wide lens gets .6x, 1x and 2x', () => {
    expect(zoomChipsFor({ min: 0.5, max: 8 }).map((chip) => chip.label)).toEqual(['.6x', '1x', '2x']);
  });

  it('without a wide lens, 1x and 2x; a 1.5x top only 1x and its top', () => {
    expect(zoomChipsFor({ min: 1, max: 10 }).map((chip) => chip.label)).toEqual(['1x', '2x']);
    expect(zoomChipsFor({ min: 1, max: 1.5 }).map((chip) => chip.ratio)).toEqual([1, 1.5]);
  });

  it('the active chip is the nearest ratio', () => {
    const chips = zoomChipsFor({ min: 0.5, max: 8 });
    expect(activeZoomChip(chips, 0.6)?.label).toBe('.6x');
    expect(activeZoomChip(chips, 2.02)?.label).toBe('2x');
    expect(activeZoomChip(chips, 3)).toBeUndefined();
  });
});
