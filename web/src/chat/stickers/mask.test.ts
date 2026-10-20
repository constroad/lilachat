import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alphaFromConfidence, MEDIAPIPE_PATH, MEDIAPIPE_VERSION, resample, visibleBox } from './mask';

/**
 * The web cutout (José, 20/10: «WhatsApp removes the background… Lilachat must
 * keep it», on the web too). MediaPipe gives a confidence per pixel; from it
 * come the alpha and the subject box.
 */
describe('cutout mask', () => {
  it('confidence becomes alpha with a soft edge, not a jagged one', () => {
    const alpha = alphaFromConfidence(new Float32Array([0, 0.2, 0.5, 0.8, 1]));
    expect(alpha[0]).toBe(0);
    expect(alpha[1]).toBe(0);
    expect(alpha[2]).toBeGreaterThan(0);
    expect(alpha[2]).toBeLessThan(255);
    expect(alpha[3]).toBe(255);
    expect(alpha[4]).toBe(255);
  });

  it('the subject box is the smallest one holding what is visible', () => {
    const alpha = new Uint8ClampedArray([0, 0, 0, 0, 0, 200, 0, 0, 0, 0, 255, 0]);
    expect(visibleBox(alpha, 4, 3)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  });

  it('almost transparent does not count (same as the app)', () => {
    expect(visibleBox(new Uint8ClampedArray([5, 10, 0, 0]), 2, 2)).toBeNull();
  });

  it('a mask of another size is taken to the photo size', () => {
    expect([...resample(new Float32Array([0, 1]), { width: 2, height: 1 }, { width: 4, height: 2 })]).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });

  it('same size: the same mask', () => {
    const values = new Float32Array([0.1, 0.9, 0.5, 0.2]);
    expect(resample(values, { width: 2, height: 2 }, { width: 2, height: 2 })).toBe(values);
  });

  it('nothing visible: no box', () => {
    expect(visibleBox(new Uint8ClampedArray(9), 3, 3)).toBeNull();
  });
});

describe('MediaPipe files', () => {
  it('the path version is the installed one: otherwise the wasm is a 404 in production', () => {
    // Vitest runs from `web/` (under jsdom `import.meta.url` is not a file).
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(manifest.dependencies['@mediapipe/tasks-vision']).toBe(MEDIAPIPE_VERSION);
    expect(MEDIAPIPE_PATH).toBe(`/mediapipe/${MEDIAPIPE_VERSION}`);
  });
});
