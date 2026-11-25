import { describe, expect, it } from 'vitest';
import { activeZoomChip, clampZoom, sliderToZoom, zoomChipsFor, zoomFromPinch, zoomLabel, zoomToSlider } from './cameraZoom.js';

// José 25/11: «como la cámara de Samsung: .6, 1, 2, 3, 5, 10 y un slider para decidir qué tan cerca».
describe('camera zoom chips', () => {
  it('a lens without zoom offers no chips (iPhone Safari, or an unknown range)', () => {
    expect(zoomChipsFor(null)).toEqual([]);
    expect(zoomChipsFor({ min: 1, max: 1 })).toEqual([]);
  });

  it('a Samsung with a wide lens and 100x gets .6x to 10x; the rest is the slider', () => {
    expect(zoomChipsFor({ min: 0.6, max: 100 }).map((chip) => chip.label)).toEqual(['.6x', '1x', '2x', '3x', '5x', '10x']);
  });

  it('only the chips this phone reaches: no .6x without a wide lens, no 10x on an 8x phone', () => {
    expect(zoomChipsFor({ min: 1, max: 8 }).map((chip) => chip.label)).toEqual(['1x', '2x', '3x', '5x']);
    expect(zoomChipsFor({ min: 0.5, max: 4 }).map((chip) => chip.label)).toEqual(['.6x', '1x', '2x', '3x']);
  });

  it('a lens that barely zooms gets 1x and its top', () => {
    expect(zoomChipsFor({ min: 1, max: 1.5 }).map((chip) => chip.ratio)).toEqual([1, 1.5]);
  });

  it('the active chip is the nearest ratio; none between two', () => {
    const chips = zoomChipsFor({ min: 0.6, max: 100 });
    expect(activeZoomChip(chips, 0.6)?.label).toBe('.6x');
    expect(activeZoomChip(chips, 5.02)?.label).toBe('5x');
    expect(activeZoomChip(chips, 3.4)).toBeUndefined();
  });
});

describe('camera zoom slider and pinch', () => {
  const samsung = { min: 0.6, max: 100 };

  it('the slider is logarithmic: its ends are the lens ends, 1x to 10x take as much as 10x to 100x', () => {
    expect(sliderToZoom(0, samsung)).toBeCloseTo(0.6);
    expect(sliderToZoom(1, samsung)).toBeCloseTo(100);
    const span = (from: number, to: number) => zoomToSlider(to, samsung) - zoomToSlider(from, samsung);
    expect(span(1, 10)).toBeCloseTo(span(10, 100));
  });

  it('slider and zoom go back and forth; out of the track it stays at the ends', () => {
    expect(sliderToZoom(zoomToSlider(3.4, samsung), samsung)).toBeCloseTo(3.4);
    expect(sliderToZoom(-0.5, samsung)).toBeCloseTo(0.6);
    expect(sliderToZoom(1.5, samsung)).toBeCloseTo(100);
  });

  it('a lens without zoom keeps the slider at the start', () => {
    expect(zoomToSlider(1, { min: 1, max: 1 })).toBe(0);
    expect(sliderToZoom(0.7, { min: 1, max: 1 })).toBe(1);
  });

  it('a pinch multiplies the ratio and never leaves the lens range', () => {
    expect(zoomFromPinch(1, 2, samsung)).toBe(2);
    expect(zoomFromPinch(1, 0.1, samsung)).toBe(0.6);
    expect(zoomFromPinch(50, 5, samsung)).toBe(100);
    expect(clampZoom(0.6, { min: 1, max: 8 })).toBe(1);
  });

  it('the readout: .6x under one, one decimal with a comma up to 10x, whole above', () => {
    expect(zoomLabel(0.6)).toBe('.6x');
    expect(zoomLabel(1)).toBe('1x');
    expect(zoomLabel(3.44)).toBe('3,4x');
    expect(zoomLabel(2.04)).toBe('2x');
    expect(zoomLabel(27.6)).toBe('28x');
  });
});
