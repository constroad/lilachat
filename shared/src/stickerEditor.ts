/**
 * The sticker editor (José, 20/10; design `s1-app-crear-sticker`), like
 * WhatsApp's: the photo without its background, text and emojis on top that
 * move, scale and rotate, a pencil, the text color, the white outline and undo.
 * Pure engine shared by app and web: coordinates go from 0 to 1 over the square
 * sticker, and the geometry is the one of the Android composition
 * (`Composition.kt`), so a sticker looks the same on both sides.
 */
export type LayerKind = 'text' | 'emoji' | 'stroke';
export type Point = { x: number; y: number };
export type Layer = {
  id: string;
  kind: LayerKind;
  text: string;
  x: number;
  y: number;
  /** Letter height relative to the sticker side. */
  scale: number;
  /** Radians, in (-π, π]. */
  rotation: number;
  color: string;
  /** Pencil only: the path (0..1) and the line width (relative to the side). */
  points?: Point[];
  width?: number;
};

export type EditorState = {
  layers: Layer[];
  selection: string | null;
  /** With the photo without background (the cutout) or the whole photo. */
  cutout: boolean;
  outline: boolean;
  /** The layers before each change, for «Deshacer». */
  history: Layer[][];
};

type LayerChange = { id: string; transient?: boolean };
export type EditorAction =
  | { type: 'add-text'; text: string }
  | { type: 'add-emoji'; emoji: string }
  | { type: 'add-stroke'; points: Point[]; color: string; width: number }
  | (LayerChange & { type: 'move'; x: number; y: number })
  | (LayerChange & { type: 'scale'; factor: number })
  | (LayerChange & { type: 'set-scale'; scale: number })
  | (LayerChange & { type: 'rotate'; delta: number })
  | (LayerChange & { type: 'transform'; x: number; y: number; scale: number; rotation: number })
  | { type: 'set-text'; id: string; text: string }
  | { type: 'set-color'; color: string }
  | { type: 'select'; id: string | null }
  | { type: 'remove'; id: string }
  | { type: 'checkpoint' }
  | { type: 'undo' }
  | { type: 'toggle-cutout' }
  | { type: 'toggle-outline' };

/** White, black, violet, yellow, red and green (design). */
export const TEXT_COLORS = ['#FFFFFF', '#111111', '#8B5CF6', '#FACC15', '#EF4444', '#22C55E'] as const;
const TEXT_SCALE = 0.13;
const EMOJI_SCALE = 0.2;
/** Text size on the web (design `s1-web-stickers`): S, M and L. */
export const STICKER_TEXT_SIZES = { S: 0.09, M: TEXT_SCALE, L: 0.19 } as const;
const MIN_SCALE = 0.05;
const MAX_SCALE = 0.45;
/** Where new text is born: at the bottom, like the lettering of stickers. */
const NEW_TEXT_Y = 0.82;
const UNDO_STEPS = 30;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Any angle into (-π, π]. */
const normalizeAngle = (angle: number) => {
  const turn = 2 * Math.PI;
  const wrapped = ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
};
let nextId = 0;
const newId = () => `layer-${Date.now().toString(36)}-${(nextId += 1)}`;

export function initialEditorState(): EditorState {
  return { layers: [], selection: null, cutout: true, outline: true, history: [] };
}

/** A layer change that can be undone (a transient one, mid-drag, cannot: the drag checkpointed first). */
function withLayers(state: EditorState, layers: Layer[], selection: string | null = state.selection, transient = false): EditorState {
  if (transient) return { ...state, layers, selection };
  return { ...state, layers, selection, history: [...state.history, state.layers].slice(-UNDO_STEPS) };
}

function add(state: EditorState, kind: 'text' | 'emoji', text: string): EditorState {
  const clean = text.trim();
  if (!clean) return state;
  const isText = kind === 'text';
  const layer: Layer = { id: newId(), kind, text: clean, x: 0.5, y: isText ? NEW_TEXT_Y : 0.5, scale: isText ? TEXT_SCALE : EMOJI_SCALE, rotation: 0, color: TEXT_COLORS[0] };
  return withLayers(state, [...state.layers, layer], layer.id);
}

function addStroke(state: EditorState, action: Extract<EditorAction, { type: 'add-stroke' }>): EditorState {
  if (action.points.length < 2) return state;
  const points = action.points.map((point) => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }));
  const layer: Layer = { id: newId(), kind: 'stroke', text: '', x: 0, y: 0, scale: 1, rotation: 0, color: action.color, points, width: action.width };
  return withLayers(state, [...state.layers, layer], null);
}

const change = (state: EditorState, id: string, update: (layer: Layer) => Layer, transient = false) =>
  state.layers.some((layer) => layer.id === id) ? withLayers(state, state.layers.map((layer) => (layer.id === id ? update(layer) : layer)), state.selection, transient) : state;

type TransformAction = Extract<EditorAction, { type: 'move' | 'scale' | 'set-scale' | 'rotate' | 'transform' }>;

function transformLayer(state: EditorState, action: TransformAction): EditorState {
  const update = (layer: Layer): Layer => {
    switch (action.type) {
      case 'move':
        return { ...layer, x: clamp(action.x, 0, 1), y: clamp(action.y, 0, 1) };
      case 'scale':
        return { ...layer, scale: clamp(layer.scale * action.factor, MIN_SCALE, MAX_SCALE) };
      case 'set-scale':
        return { ...layer, scale: clamp(action.scale, MIN_SCALE, MAX_SCALE) };
      case 'rotate':
        return { ...layer, rotation: normalizeAngle(layer.rotation + action.delta) };
      case 'transform':
        return { ...layer, x: clamp(action.x, 0, 1), y: clamp(action.y, 0, 1), scale: clamp(action.scale, MIN_SCALE, MAX_SCALE), rotation: normalizeAngle(action.rotation) };
    }
  };
  return change(state, action.id, update, action.transient);
}

function remove(state: EditorState, id: string): EditorState {
  if (!state.layers.some((layer) => layer.id === id)) return state;
  return withLayers(state, state.layers.filter((layer) => layer.id !== id), state.selection === id ? null : state.selection);
}

function undo(state: EditorState): EditorState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  const selection = previous.some((layer) => layer.id === state.selection) ? state.selection : null;
  return { ...state, layers: previous, history: state.history.slice(0, -1), selection };
}

export function editSticker(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'add-text':
      return add(state, 'text', action.text);
    case 'add-emoji':
      return add(state, 'emoji', action.emoji);
    case 'add-stroke':
      return addStroke(state, action);
    case 'move':
    case 'scale':
    case 'set-scale':
    case 'rotate':
    case 'transform':
      return transformLayer(state, action);
    case 'set-text':
      if (!action.text.trim()) return remove(state, action.id);
      return change(state, action.id, (layer) => ({ ...layer, text: action.text }));
    case 'set-color': {
      const selected = state.layers.find((layer) => layer.id === state.selection);
      return selected?.kind === 'text' ? change(state, selected.id, (layer) => ({ ...layer, color: action.color })) : state;
    }
    case 'select':
      return { ...state, selection: action.id };
    case 'remove':
      return remove(state, action.id);
    case 'checkpoint':
      return { ...state, history: [...state.history, state.layers].slice(-UNDO_STEPS) };
    case 'undo':
      return undo(state);
    case 'toggle-cutout':
      return { ...state, cutout: !state.cutout };
    case 'toggle-outline':
      return { ...state, outline: !state.outline };
  }
}

/** What the composition receives: the layers without ids, in drawing order. */
export function layersForComposition(state: EditorState) {
  return state.layers.map(({ id: _id, ...layer }) => layer);
}

/** The sticker side and how the white outline is drawn: the same numbers as `Composition.kt`. */
export const STICKER_COMPOSITION = { side: 512, outlineMargin: 30, plainMargin: 12, outlineRadius: 9, outlineSteps: 24, textStroke: 0.14 } as const;

export type Rect = { x: number; y: number; width: number; height: number };

/** Where the image goes on the canvas: whole, centered, with the room the outline needs. */
export function stickerGeometry(input: { width: number; height: number; outline: boolean }): Rect {
  const { side, outlineMargin, plainMargin } = STICKER_COMPOSITION;
  if (input.width <= 0 || input.height <= 0) return { x: side / 2, y: side / 2, width: 0, height: 0 };
  const available = side - 2 * (input.outline ? outlineMargin : plainMargin);
  const factor = Math.min(available / input.width, available / input.height);
  const width = Math.round(input.width * factor);
  const height = Math.round(input.height * factor);
  return { x: Math.round((side - width) / 2), y: Math.round((side - height) / 2), width, height };
}
