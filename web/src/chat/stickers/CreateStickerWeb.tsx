import { useEffect, useMemo, useReducer, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Eraser, ImageUp, Loader2, Paintbrush, Pencil, Scissors, Undo2, X } from 'lucide-react';
import { BRUSH_SIZES, editSticker, initialEditorState, maskStroke, paletaDe, photoFrame, STICKER_COMPOSITION, STICKER_TEXT_SIZES, stickerGeometry, TEXT_COLORS, type BrushSize, type CutoutView, type Layer, type LibrarySticker, type MaskMode, type Point } from '@lilachat/shared';
import type { ApiResult } from '../../api';
import { drawSticker, exportSticker, layerBox, toLayerFrame } from './composeWeb';
import { photoToCanvas, refineWeb, removeBackground } from './cutoutWeb';

type Phase = 'picking' | 'cutting' | 'editing' | 'saving';
type Size = keyof typeof STICKER_TEXT_SIZES;
type Drag = { mode: 'move' | 'rotate' | 'scale'; layer: Layer; start: Point } | { mode: 'pen' | 'brush'; points: Point[] };
/** How the brush stroke looks while drawing, before the cutout is redone (like the app). */
const BRUSH_TRAIL: Record<MaskMode, string> = { erase: 'rgba(239,68,68,0.55)', restore: 'rgba(34,197,94,0.55)' };
const EMOJIS = ['😂', '😍', '🔥', '👍', '🎉', '❤️', '😎', '🙏', '💯', '👏', '🚀', '✅'];
const CENTER: Point = { x: 0.5, y: 0.5 };
const SIDE = STICKER_COMPOSITION.side;
const BOX_PADDING = 10;
const ROTATE_GAP = 30;
const HANDLE_RADIUS = 9;
const HIT_RADIUS = 18;
const PEN_WIDTH = 0.022;
const NO_CUTOUT = 'No se pudo quitar el fondo: borra a mano lo que no quieras, o va la foto entera.';
/** The canvas cannot read the Tailwind tokens: the brand color comes from the shared palette. */
const SELECTION_COLOR = paletaDe('light').primary;

type Props = {
  chatName: string;
  onClose: () => void;
  onSave: (file: Blob) => Promise<ApiResult<{ sticker: LibrarySticker }>>;
  onSend: (sticker: LibrarySticker) => Promise<boolean>;
  onRemove: (sticker: LibrarySticker) => Promise<void>;
};

/** Where the handles of a layer are, on the 512 canvas. */
function handlesOf(context: CanvasRenderingContext2D, layer: Layer) {
  const box = layerBox(context, layer);
  const place = (x: number, y: number) => ({ x: box.cx + x * Math.cos(layer.rotation) - y * Math.sin(layer.rotation), y: box.cy + x * Math.sin(layer.rotation) + y * Math.cos(layer.rotation) });
  const width = box.halfWidth + BOX_PADDING;
  const height = box.halfHeight + BOX_PADDING;
  return { box, width, height, rotate: place(0, -height - ROTATE_GAP), scale: place(width, height) };
}

/** The dashed selection box with its rotation and scale handles (design: like the app). */
function drawSelection(context: CanvasRenderingContext2D, layer: Layer) {
  const { box, width, height, rotate, scale } = handlesOf(context, layer);
  context.save();
  context.translate(box.cx, box.cy);
  context.rotate(layer.rotation);
  context.setLineDash([8, 6]);
  context.lineWidth = 3;
  context.strokeStyle = SELECTION_COLOR;
  context.strokeRect(-width, -height, width * 2, height * 2);
  context.restore();
  for (const handle of [rotate, scale]) {
    context.beginPath();
    context.arc(handle.x, handle.y, HANDLE_RADIUS, 0, 2 * Math.PI);
    context.fillStyle = 'white';
    context.fill();
    context.lineWidth = 3;
    context.setLineDash([]);
    context.strokeStyle = SELECTION_COLOR;
    context.stroke();
  }
}

/**
 * «Crear sticker» on the web (José, 20/10: «I upload a photo, WhatsApp removes
 * the background, I add text and make the sticker»; design `s1-web-stickers`).
 * The photo is cut in the browser (MediaPipe); text and emojis move, scale and
 * rotate with their handles; the pencil draws; the result is the same 512×512
 * the app builds.
 */
export function CreateStickerWeb(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [phase, setPhase] = useState<Phase>('picking');
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  /** The cutout as a mask over the photo (alpha per pixel); erase/restore strokes go on top. */
  const [mask, setMask] = useState<Uint8ClampedArray | null>(null);
  const [brush, setBrush] = useState<{ mode: MaskMode; size: BrushSize } | null>(null);
  const [notice, setNotice] = useState('');
  const [penOn, setPenOn] = useState(false);
  const [penColor, setPenColor] = useState<string>(TEXT_COLORS[0]);
  const [livePen, setLivePen] = useState<Point[]>([]);
  const [keepInMine, setKeepInMine] = useState(true);
  const [state, dispatch] = useReducer(editSticker, undefined, initialEditorState);
  // The image as it looks now: the mask (if on) and every brush stroke, cropped (`refineWeb`, like the app's `CutoutMask`).
  const shown = useMemo(() => (photo ? refineWeb(photo, state.cutout ? mask : null, state.maskStrokes) : null), [photo, mask, state.cutout, state.maskStrokes]);
  const image = shown?.canvas ?? null;
  const view: CutoutView | null = shown ? { box: shown.box, geometry: stickerGeometry({ width: shown.canvas.width, height: shown.canvas.height, outline: state.outline }), side: SIDE } : null;
  const textLayer = state.layers.find((layer) => layer.kind === 'text');
  const selected = state.layers.find((layer) => layer.id === state.selection);

  // The gallery opens by itself: the click on «Crear» still counts as a gesture.
  useEffect(() => fileRef.current?.click(), []);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !image) return;
    const trail = brush ? { color: BRUSH_TRAIL[brush.mode], width: BRUSH_SIZES[brush.size] * 2 } : { color: penColor, width: PEN_WIDTH };
    const live = livePen.length > 1 ? [{ kind: 'stroke' as const, text: '', x: 0, y: 0, scale: 1, rotation: 0, points: livePen, ...trail }] : [];
    const backdrop = brush?.mode === 'restore' && photo && view ? { image: photo, frame: photoFrame(photo, view) } : undefined;
    drawSticker(canvas, image, state.outline, [...state.layers, ...live], backdrop);
    if (selected && selected.kind !== 'stroke') drawSelection(context, selected);
  }, [image, state.outline, state.layers, selected, livePen, penColor, brush, photo, view]);

  const cut = async (source: HTMLCanvasElement, point: Point) => {
    setPhase('cutting');
    try {
      const subject = await removeBackground(source, point);
      setMask(subject);
      setNotice(subject ? '' : 'No encontré a nadie ni nada para recortar: haz clic sobre lo que quieres.');
      if (subject && !state.cutout) dispatch({ type: 'toggle-cutout' });
    } catch (error) {
      console.error('[stickers] cutout', error);
      setNotice(NO_CUTOUT);
    }
    setPhase('editing');
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return photo ? undefined : props.onClose();
    try {
      const fresh = await photoToCanvas(file);
      setPhoto(fresh);
      setMask(null);
      await cut(fresh, CENTER);
    } catch {
      setNotice('No se pudo abrir esa imagen.');
      setPhase(photo ? 'editing' : 'picking');
    }
  };

  const write = (text: string) => (textLayer ? dispatch({ type: 'set-text', id: textLayer.id, text }) : dispatch({ type: 'add-text', text }));

  const finish = async () => {
    if (!image || phase !== 'editing') return;
    setPhase('saving');
    const clean = document.createElement('canvas');
    drawSticker(clean, image, state.outline, state.layers);
    const file = await exportSticker(clean);
    const saved = file ? await props.onSave(file) : null;
    if (!saved?.ok) {
      setNotice(saved?.message ?? 'No se pudo armar el sticker.');
      return setPhase('editing');
    }
    if (!(await props.onSend(saved.data.sticker))) {
      setNotice('Se guardó en Mis stickers, pero no se pudo mandar.');
      return setPhase('editing');
    }
    if (!keepInMine) await props.onRemove(saved.data.sticker);
    props.onClose();
  };

  const pointOf = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * SIDE, y: ((event.clientY - rect.top) / rect.height) * SIDE };
  };

  const layerAt = (context: CanvasRenderingContext2D, point: Point) =>
    [...state.layers].reverse().find((layer) => {
      if (layer.kind === 'stroke') return false;
      const box = layerBox(context, layer);
      const local = toLayerFrame(point, box, layer.rotation);
      return Math.abs(local.x) <= box.halfWidth + BOX_PADDING && Math.abs(local.y) <= box.halfHeight + BOX_PADDING;
    });

  const press = (event: PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d');
    if (!context || phase !== 'editing') return;
    const point = pointOf(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (penOn || brush) {
      drag.current = { mode: brush ? 'brush' : 'pen', points: [{ x: point.x / SIDE, y: point.y / SIDE }] };
      return;
    }
    if (selected && selected.kind !== 'stroke') {
      const handles = handlesOf(context, selected);
      const near = (handle: Point) => Math.hypot(handle.x - point.x, handle.y - point.y) <= HIT_RADIUS;
      const mode = near(handles.rotate) ? 'rotate' : near(handles.scale) ? 'scale' : null;
      if (mode) {
        dispatch({ type: 'checkpoint' });
        drag.current = { mode, layer: selected, start: point };
        return;
      }
    }
    const hit = layerAt(context, point);
    if (hit) {
      dispatch({ type: 'select', id: hit.id });
      dispatch({ type: 'checkpoint' });
      drag.current = { mode: 'move', layer: hit, start: point };
      return;
    }
    dispatch({ type: 'select', id: null });
    // Without the cutout on, a click on the photo cuts THAT (in case the center was not the subject).
    if (photo && !(state.cutout && mask)) {
      const target = stickerGeometry({ width: photo.width, height: photo.height, outline: state.outline });
      const inPhoto = { x: (point.x - target.x) / target.width, y: (point.y - target.y) / target.height };
      if (inPhoto.x >= 0 && inPhoto.x <= 1 && inPhoto.y >= 0 && inPhoto.y <= 1) void cut(photo, inPhoto);
    }
  };

  const moveTo = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current) return;
    const point = pointOf(event);
    if ('points' in current) {
      current.points.push({ x: point.x / SIDE, y: point.y / SIDE });
      return setLivePen([...current.points]);
    }
    const { layer, start } = current;
    const center = { x: layer.x * SIDE, y: layer.y * SIDE };
    if (current.mode === 'move') return dispatch({ type: 'move', id: layer.id, x: layer.x + (point.x - start.x) / SIDE, y: layer.y + (point.y - start.y) / SIDE, transient: true });
    const rotation = current.mode === 'rotate' ? layer.rotation + Math.atan2(point.y - center.y, point.x - center.x) - Math.atan2(start.y - center.y, start.x - center.x) : layer.rotation;
    const scale = current.mode === 'scale' ? layer.scale * (Math.hypot(point.x - center.x, point.y - center.y) / Math.max(1, Math.hypot(start.x - center.x, start.y - center.y))) : layer.scale;
    dispatch({ type: 'transform', id: layer.id, x: layer.x, y: layer.y, scale, rotation, transient: true });
  };

  const release = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.mode === 'brush' && brush && view) {
      const stroke = maskStroke(brush.mode, BRUSH_SIZES[brush.size], current.points, view);
      if (stroke) dispatch({ type: 'add-mask-stroke', stroke });
    }
    if (current?.mode === 'pen') dispatch({ type: 'add-stroke', points: current.points, color: penColor, width: PEN_WIDTH });
    setLivePen([]);
  };
  const pickBrush = (mode: MaskMode) => {
    dispatch({ type: 'select', id: null });
    setPenOn(false);
    setBrush((before) => (before?.mode === mode ? null : { mode, size: before?.size ?? 'M' }));
  };

  const pickColor = (color: string) => {
    if (penOn) return setPenColor(color);
    if (!textLayer) return;
    dispatch({ type: 'select', id: textLayer.id });
    dispatch({ type: 'set-color', color });
  };
  const currentSize = (Object.keys(STICKER_TEXT_SIZES) as Size[]).find((key) => STICKER_TEXT_SIZES[key] === textLayer?.scale);
  const activeColor = penOn ? penColor : textLayer?.color;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={props.onClose}>
      <div data-testid="crear-sticker" role="dialog" aria-label="Crear sticker" onClick={(event) => event.stopPropagation()} className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-outline/15 px-4 py-3">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />
          <h2 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">Crear sticker</h2>
          <button type="button" data-testid="btn-cerrar-sticker" aria-label="Cerrar" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={20} /></button>
        </header>
        <input ref={fileRef} data-testid="input-foto-sticker" type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void pickPhoto(file); }} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="relative mx-auto grid aspect-square w-full max-w-[320px] place-items-center overflow-hidden rounded-xl border border-outline/15 bg-[conic-gradient(rgb(0_0_0/0.06)_25%,transparent_0_50%,rgb(0_0_0/0.06)_0_75%,transparent_0)] bg-[length:20px_20px]">
            {image ? (
              <canvas ref={canvasRef} data-testid="lienzo-sticker" onPointerDown={press} onPointerMove={moveTo} onPointerUp={release} onPointerCancel={release} className={`h-full w-full touch-none ${penOn || brush ? 'cursor-crosshair' : 'cursor-move'}`} />
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 text-sm text-on-surface-variant"><ImageUp size={28} /> Elige una foto</button>
            )}
            {phase === 'cutting' ? (
              <span className="absolute inset-0 grid place-items-center bg-surface/60 text-sm font-semibold"><span className="flex flex-col items-center"><span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Quitando el fondo…</span><span className="mt-1 block text-[11px] font-normal text-on-surface-variant">La primera vez tarda unos segundos.</span></span></span>
            ) : null}
            {mask && state.cutout && !brush ? <span data-testid="pastilla-fondo-eliminado" className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full border border-outline/15 bg-surface px-2.5 py-1 text-[12px] font-semibold text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Fondo eliminado</span> : null}
            {image ? <button type="button" data-testid="btn-cambiar-foto" onClick={() => fileRef.current?.click()} className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-outline/15 bg-surface px-2.5 py-1 text-[12px] font-semibold"><ImageUp size={13} /> Cambiar</button> : null}
          </div>
          {notice ? <p role="status" data-testid="aviso-sticker" className="mt-2 text-center text-[12px] text-on-surface-variant">{notice}</p> : null}
          {photo && !(mask && state.cutout) && phase === 'editing' && !penOn && !brush ? <p className="mt-1 text-center text-[12px] text-on-surface-variant">Haz clic sobre lo que quieras recortar.</p> : null}
          {brush ? <p data-testid="ayuda-pincel" className="mt-1 text-center text-[12px] text-on-surface-variant">{brush.mode === 'erase' ? 'Pasa el mouse con el botón apretado por lo que quieras quitar.' : 'Pasa el mouse con el botón apretado por lo que quieras recuperar de la foto.'}</p> : null}

          <div role="group" aria-label="Retocar el recorte" className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-outline/15 p-2">
            <div className="flex gap-1">
              <button type="button" data-testid="btn-borrar-sticker" aria-pressed={brush?.mode === 'erase'} disabled={!image} onClick={() => pickBrush('erase')} className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold disabled:opacity-40 ${brush?.mode === 'erase' ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-background'}`}><Eraser size={15} /> Borrar</button>
              <button type="button" data-testid="btn-restaurar-sticker" aria-pressed={brush?.mode === 'restore'} disabled={!image} onClick={() => pickBrush('restore')} className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold disabled:opacity-40 ${brush?.mode === 'restore' ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-background'}`}><Paintbrush size={15} /> Restaurar</button>
            </div>
            <div role="group" aria-label="Tamaño del pincel" className="flex items-center gap-1">
              {(Object.keys(BRUSH_SIZES) as BrushSize[]).map((size) => (
                <button key={size} type="button" data-testid={`pincel-${size}`} aria-label={`Pincel ${size}`} aria-pressed={brush?.size === size} disabled={!brush} onClick={() => setBrush((before) => (before ? { ...before, size } : before))} className={`grid h-8 w-8 place-items-center rounded-full disabled:opacity-40 ${brush?.size === size ? 'ring-2 ring-primary' : ''}`}>
                  <span className="rounded-full bg-on-surface-variant" style={{ width: { S: 6, M: 10, L: 16 }[size], height: { S: 6, M: 10, L: 16 }[size] }} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 divide-y divide-outline/10">
            <Toggle testId="interruptor-recorte" icon={<Scissors size={15} />} label="Quitar fondo automáticamente" on={Boolean(mask) && state.cutout} onToggle={() => (mask ? dispatch({ type: 'toggle-cutout' }) : photo && void cut(photo, CENTER))} />
            <Toggle testId="interruptor-borde" label="Borde blanco" on={state.outline} onToggle={() => dispatch({ type: 'toggle-outline' })} />
          </div>

          <section className="mt-3 rounded-xl border border-outline/15 p-3">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="sticker-text" className="text-[13px] font-semibold">Texto del sticker</label>
              <div role="group" aria-label="Tamaño" className="flex items-center gap-0.5 rounded-lg border border-outline/15 p-0.5 text-[12px]">
                <span className="px-1 text-on-surface-variant">Tamaño:</span>
                {(Object.keys(STICKER_TEXT_SIZES) as Size[]).map((key) => (
                  <button key={key} type="button" data-testid={`tamano-${key}`} aria-pressed={currentSize === key} disabled={!textLayer} onClick={() => textLayer && dispatch({ type: 'set-scale', id: textLayer.id, scale: STICKER_TEXT_SIZES[key] })} className={`h-7 w-7 rounded-md font-semibold disabled:opacity-40 ${currentSize === key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'}`}>{key}</button>
                ))}
              </div>
            </div>
            <input id="sticker-text" data-testid="input-texto-sticker" value={textLayer?.text ?? ''} maxLength={40} placeholder="¡Listo!" onFocus={() => textLayer && dispatch({ type: 'select', id: textLayer.id })} onChange={(event) => write(event.target.value)} className="h-11 w-full rounded-lg border border-outline/20 bg-background px-3 text-sm outline-none focus:border-primary" />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[13px] text-on-surface-variant">Color:</span>
              <div className="flex gap-1.5">
                {TEXT_COLORS.map((color) => (
                  <button key={color} type="button" data-testid={`color-${color}`} aria-label={`Color ${color}`} aria-pressed={activeColor === color} disabled={!textLayer && !penOn} onClick={() => pickColor(color)} className={`h-7 w-7 rounded-full border border-outline/30 disabled:opacity-40 ${activeColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </section>

          <div className="mt-3 flex items-center gap-1 overflow-x-auto">
            {EMOJIS.map((emoji) => <button key={emoji} type="button" data-testid={`emoji-sticker-${emoji}`} aria-label={`Agregar ${emoji}`} onClick={() => { setPenOn(false); dispatch({ type: 'add-emoji', emoji }); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl hover:bg-background">{emoji}</button>)}
            <button type="button" data-testid="btn-lapiz-sticker" aria-label="Dibujar" aria-pressed={penOn} onClick={() => { dispatch({ type: 'select', id: null }); setBrush(null); setPenOn((before) => !before); }} className={`ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg ${penOn ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-background'}`}><Pencil size={18} /></button>
            <button type="button" data-testid="btn-deshacer-sticker" aria-label="Deshacer" onClick={() => dispatch({ type: 'undo' })} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-background"><Undo2 size={18} /></button>
          </div>

          <label className="mt-3 flex min-h-[44px] items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" data-testid="check-guardar-sticker" checked={keepInMine} onChange={(event) => setKeepInMine(event.target.checked)} className="h-4 w-4 accent-primary" />
            Guardar en Mis stickers
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-outline/15 px-4 py-3">
          <span className="mr-auto truncate text-[12px] text-on-surface-variant">Para: <b className="text-on-surface">{props.chatName}</b></span>
          <button type="button" onClick={props.onClose} className="h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-background">Cancelar</button>
          <button type="button" data-testid="btn-mandar-sticker" disabled={!image || phase !== 'editing'} onClick={() => void finish()} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">
            {phase === 'saving' ? <Loader2 size={15} className="animate-spin" /> : null} Enviar sticker
          </button>
        </footer>
      </div>
    </div>
  );
}

function Toggle(props: { testId: string; label: string; on: boolean; icon?: ReactNode; onToggle: () => void }) {
  return (
    <button type="button" role="switch" data-testid={props.testId} aria-checked={props.on} onClick={props.onToggle} className="flex min-h-[44px] w-full items-center gap-2 text-left text-[13px] font-semibold">
      <span className="text-primary">{props.icon}</span>
      <span className="flex-1">{props.label}</span>
      <span className={`relative h-6 w-10 rounded-full transition-colors ${props.on ? 'bg-primary' : 'bg-outline/30'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${props.on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
