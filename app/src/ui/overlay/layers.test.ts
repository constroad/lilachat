import { describe, expect, it } from 'vitest';
import { removeLayer, replaceOrAppend } from './layers';

/**
 * The stack of in-window overlays (plan 1, F1). Measured on the emulator
 * (02/11): every CLOSED sheet of the chat told the host «remove me» on each
 * render, and the host got a new array every time, so it redrew for nothing;
 * opening a chat went from 85 ms to 450 ms in its worst frame. Removing what is
 * not there must return the SAME array, so React skips the render.
 */
type Layer = { id: number; node: string };
const layer = (id: number, node = `n${id}`): Layer => ({ id, node });

describe('removeLayer', () => {
  it('removes the layer with that id', () => {
    expect(removeLayer([layer(1), layer(2)], 1)).toEqual([layer(2)]);
  });

  it('a layer that is not there returns the very same array (no redraw)', () => {
    const layers = [layer(1)];
    expect(removeLayer(layers, 7)).toBe(layers);
  });

  it('an empty stack stays the same empty stack', () => {
    const empty: Layer[] = [];
    expect(removeLayer(empty, 1)).toBe(empty);
  });
});

describe('replaceOrAppend', () => {
  it('a new layer goes on top', () => {
    expect(replaceOrAppend([layer(1)], layer(2))).toEqual([layer(1), layer(2)]);
  });

  it('an existing layer is replaced in its place (its content changed)', () => {
    expect(replaceOrAppend([layer(1), layer(2)], layer(1, 'new'))).toEqual([layer(1, 'new'), layer(2)]);
  });
});
