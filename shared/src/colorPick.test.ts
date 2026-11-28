import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, unitAt } from './colorPick.js';

describe('hsvToHex', () => {
  it('gives the pure hues and the greys', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000ff');
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe('#ffffff');
    expect(hsvToHex({ h: 200, s: 0.5, v: 0 })).toBe('#000000');
  });

  it('wraps 360 back to red', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
  });
});

describe('hexToHsv', () => {
  it('reads back what hsvToHex writes', () => {
    const hsv = hexToHsv('#2563eb');
    expect(hsvToHex(hsv)).toBe('#2563eb');
  });

  it('is null for something that is not a #rrggbb color', () => {
    expect(hexToHsv('azul')).toBeNull();
    expect(hexToHsv('#12345')).toBeNull();
  });
});

describe('unitAt', () => {
  it('turns a finger position into 0..1, clamped to the box', () => {
    expect(unitAt(50, 200)).toBe(0.25);
    expect(unitAt(-10, 200)).toBe(0);
    expect(unitAt(260, 200)).toBe(1);
    expect(unitAt(10, 0)).toBe(0);
  });
});
