import { describe, expect, it } from 'vitest';
import { editSticker, initialEditorState, layersForComposition, STICKER_TEXT_SIZES, stickerGeometry, TEXT_COLORS, type EditorState } from './stickerEditor.js';

/**
 * The sticker editor (José, 20/10: «I upload a photo, the background goes away,
 * I add text»; design `s1-app-crear-sticker`). Pure engine shared by app and web.
 */
const withText = (text = 'Hola'): EditorState => editSticker(initialEditorState(), { type: 'add-text', text });

describe('sticker editor', () => {
  it('starts with the cutout and the white outline on, and nothing on top', () => {
    expect(initialEditorState()).toEqual({ layers: [], selection: null, cutout: true, outline: true, maskStrokes: [], history: [] });
  });

  it('new text goes at the bottom, white, upright and selected; blank text is ignored', () => {
    const state = withText();
    expect(state.layers).toEqual([expect.objectContaining({ kind: 'text', text: 'Hola', x: 0.5, color: TEXT_COLORS[0], rotation: 0 })]);
    expect(state.layers[0]!.y).toBeGreaterThan(0.7);
    expect(state.selection).toBe(state.layers[0]!.id);
    expect(editSticker(initialEditorState(), { type: 'add-text', text: '   ' }).layers).toEqual([]);
  });

  it('moving stays inside the sticker', () => {
    const state = withText();
    const moved = editSticker(state, { type: 'move', id: state.layers[0]!.id, x: 1.4, y: -0.2 });
    expect(moved.layers[0]).toMatchObject({ x: 1, y: 0 });
  });

  it('scale has limits; rotation is kept in (-π, π]', () => {
    const state = withText();
    const id = state.layers[0]!.id;
    expect(editSticker(state, { type: 'scale', id, factor: 50 }).layers[0]!.scale).toBe(0.45);
    expect(editSticker(state, { type: 'scale', id, factor: 0.001 }).layers[0]!.scale).toBe(0.05);
    expect(editSticker(state, { type: 'rotate', id, delta: Math.PI / 6 }).layers[0]!.rotation).toBeCloseTo(Math.PI / 6);
    expect(editSticker(state, { type: 'rotate', id, delta: (3 * Math.PI) / 2 }).layers[0]!.rotation).toBeCloseTo(-Math.PI / 2);
  });

  it('a gesture commits once: transform sets position, size and angle in one undo step', () => {
    const state = withText();
    const id = state.layers[0]!.id;
    const done = editSticker(state, { type: 'transform', id, x: 0.3, y: 0.4, scale: 0.2, rotation: 0.5 });
    expect(done.layers[0]).toMatchObject({ x: 0.3, y: 0.4, scale: 0.2, rotation: 0.5 });
    expect(editSticker(done, { type: 'undo' }).layers[0]).toMatchObject({ x: 0.5, rotation: 0 });
  });

  it('live dragging does not flood the history: checkpoint once, then transient moves', () => {
    let state = withText();
    const id = state.layers[0]!.id;
    const before = state.history.length;
    state = editSticker(state, { type: 'checkpoint' });
    for (let step = 1; step <= 5; step += 1) state = editSticker(state, { type: 'move', id, x: 0.1 * step, y: 0.5, transient: true });
    expect(state.history.length).toBe(before + 1);
    expect(editSticker(state, { type: 'undo' }).layers[0]!.x).toBe(0.5);
  });

  it('the color goes to the selected text only (an emoji keeps its own colors)', () => {
    let state = withText();
    state = editSticker(state, { type: 'set-color', color: TEXT_COLORS[3] });
    expect(state.layers[0]!.color).toBe(TEXT_COLORS[3]);
    state = editSticker(state, { type: 'add-emoji', emoji: '🔥' });
    const emoji = editSticker(state, { type: 'set-color', color: TEXT_COLORS[1] }).layers[1]!;
    expect(emoji.color).toBe(TEXT_COLORS[0]);
  });

  it('editing the text in place; emptying it removes the layer', () => {
    let state = withText('Ho');
    const id = state.layers[0]!.id;
    state = editSticker(state, { type: 'set-text', id, text: 'Hola' });
    expect(state.layers[0]!.text).toBe('Hola');
    expect(editSticker(state, { type: 'set-text', id, text: ' ' })).toMatchObject({ layers: [], selection: null });
  });

  it('S/M/L sizes set the scale', () => {
    const state = withText();
    const id = state.layers[0]!.id;
    expect(editSticker(state, { type: 'set-scale', id, scale: STICKER_TEXT_SIZES.L }).layers[0]!.scale).toBe(STICKER_TEXT_SIZES.L);
    expect(STICKER_TEXT_SIZES.S).toBeLessThan(STICKER_TEXT_SIZES.M);
  });

  it('the pencil adds a stroke (2+ points), not selectable, removable with undo', () => {
    let state = editSticker(initialEditorState(), { type: 'add-stroke', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.3 }], color: TEXT_COLORS[2], width: 0.02 });
    expect(state.layers[0]).toMatchObject({ kind: 'stroke', color: TEXT_COLORS[2], width: 0.02, points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.3 }] });
    expect(state.selection).toBeNull();
    expect(editSticker(state, { type: 'add-stroke', points: [{ x: 0.1, y: 0.1 }], color: 'x', width: 0.02 })).toBe(state);
    state = editSticker(state, { type: 'undo' });
    expect(state.layers).toEqual([]);
  });

  it('undo goes back one step; with no history it does nothing', () => {
    let state = editSticker(withText('One'), { type: 'add-text', text: 'Two' });
    state = editSticker(state, { type: 'undo' });
    expect(state.layers.map((layer) => layer.text)).toEqual(['One']);
    state = editSticker(editSticker(state, { type: 'undo' }), { type: 'undo' });
    expect(state.layers).toEqual([]);
  });

  it('remove drops the layer and its selection; an unknown id changes nothing', () => {
    const state = withText();
    expect(editSticker(state, { type: 'remove', id: state.layers[0]!.id })).toMatchObject({ layers: [], selection: null });
    expect(editSticker(state, { type: 'remove', id: 'nope' })).toBe(state);
  });

  it('cutout and outline toggle', () => {
    const state = editSticker(editSticker(initialEditorState(), { type: 'toggle-cutout' }), { type: 'toggle-outline' });
    expect(state).toMatchObject({ cutout: false, outline: false });
  });

  it('for composition: layers without ids, in drawing order', () => {
    let state = withText();
    state = editSticker(state, { type: 'add-emoji', emoji: '🎉' });
    expect(layersForComposition(state)).toEqual([
      { kind: 'text', text: 'Hola', x: 0.5, y: state.layers[0]!.y, scale: state.layers[0]!.scale, rotation: 0, color: TEXT_COLORS[0] },
      { kind: 'emoji', text: '🎉', x: 0.5, y: 0.5, scale: state.layers[1]!.scale, rotation: 0, color: TEXT_COLORS[0] },
    ]);
  });
});

describe('sticker geometry (same numbers as the Android composition)', () => {
  it('the image fits centered with the outline margin', () => {
    expect(stickerGeometry({ width: 1000, height: 500, outline: true })).toEqual({ x: 30, y: 143, width: 452, height: 226 });
    expect(stickerGeometry({ width: 200, height: 400, outline: false })).toEqual({ x: 134, y: 12, width: 244, height: 488 });
  });

  it('an empty image does not divide by zero', () => {
    expect(stickerGeometry({ width: 0, height: 0, outline: true })).toEqual({ x: 256, y: 256, width: 0, height: 0 });
  });

  it('erase and restore strokes are kept in order and «Deshacer» removes the last one', () => {
    const erase = { mode: 'erase' as const, radius: 20, points: [{ x: 10, y: 10 }] };
    const restore = { mode: 'restore' as const, radius: 30, points: [{ x: 50, y: 60 }, { x: 70, y: 60 }] };
    let state = editSticker(initialEditorState(), { type: 'add-text', text: 'Hola' });
    state = editSticker(state, { type: 'add-mask-stroke', stroke: erase });
    state = editSticker(state, { type: 'add-mask-stroke', stroke: restore });
    expect(state.maskStrokes).toEqual([erase, restore]);
    expect(state.selection).toBeNull();

    state = editSticker(state, { type: 'undo' });
    expect(state.maskStrokes).toEqual([erase]);
    expect(state.layers).toHaveLength(1);

    state = editSticker(editSticker(state, { type: 'undo' }), { type: 'undo' });
    expect(state.maskStrokes).toEqual([]);
    expect(state.layers).toHaveLength(0);
  });

  it('a mask stroke with no points changes nothing', () => {
    const state = initialEditorState();
    expect(editSticker(state, { type: 'add-mask-stroke', stroke: { mode: 'erase', radius: 10, points: [] } })).toBe(state);
  });
});
