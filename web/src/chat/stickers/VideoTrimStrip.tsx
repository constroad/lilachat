import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { clipSeconds, clipTime, moveTrim, msAtStrip, resizeTrimEnd, resizeTrimStart, stripTicks, trimLengthMs, type TrimWindow } from './videoSticker';

type DragMode = 'move' | 'start' | 'end';
type Drag = { mode: DragMode; fromMs: number; trim: TrimWindow };

/** Labeled tiles along the strip (design ss-04). */
const STRIP_TILES = 5;
/** Arrow keys move a quarter of a second; with Shift, a whole second. */
const KEY_STEP_MS = 250;
const KEY_STEP_LONG_MS = 1_000;

type Props = { videoMs: number; trim: TrimWindow; disabled: boolean; onChange: (trim: TrimWindow) => void };

/**
 * «Recorte del video» (José 26/11, design ss-04): the strip of the whole video
 * with the window the sticker keeps. The window drags; its handles stretch it
 * between half a second and 6 s (the limits live in `videoSticker.ts`).
 */
/** The pointer and the keys over the strip: what each press drags and where the window goes. */
function useTrimDrag({ videoMs, trim, disabled, onChange }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const msAt = (clientX: number) => {
    const rect = strip.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? msAtStrip((clientX - rect.left) / rect.width, videoMs) : trim.startMs;
  };
  const apply = (mode: DragMode, base: TrimWindow, toMs: number) =>
    onChange(mode === 'move' ? moveTrim(base, toMs, videoMs) : mode === 'start' ? resizeTrimStart(base, toMs, videoMs) : resizeTrimEnd(base, toMs, videoMs));
  const grab = (mode: DragMode, event: PointerEvent<HTMLElement>, base: TrimWindow) => {
    strip.current?.setPointerCapture?.(event.pointerId);
    drag.current = { mode, fromMs: msAt(event.clientX), trim: base };
  };
  const press = (mode: DragMode) => (event: PointerEvent<HTMLElement>) => {
    if (disabled) return;
    event.stopPropagation();
    grab(mode, event, trim);
  };
  // A press on the strip outside the window centers the window there.
  const pressStrip = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const centered = moveTrim(trim, msAt(event.clientX) - trimLengthMs(trim) / 2, videoMs);
    onChange(centered);
    grab('move', event, centered);
  };
  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const at = msAt(event.clientX);
    apply(current.mode, current.trim, current.mode === 'move' ? current.trim.startMs + at - current.fromMs : at);
  };
  const release = () => {
    drag.current = null;
  };
  const nudge = (mode: DragMode) => (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? KEY_STEP_LONG_MS : KEY_STEP_MS;
    const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    if (!delta || disabled) return;
    event.preventDefault();
    apply(mode, trim, (mode === 'end' ? trim.endMs : trim.startMs) + delta);
  };
  return { strip, press, pressStrip, moveTo, release, nudge };
}

/**
 * «Recorte del video» (José 26/11, design ss-04): the strip of the whole video
 * with the window the sticker keeps. The window drags; its handles stretch it
 * between half a second and 6 s (the limits live in `videoSticker.ts`).
 */
export function VideoTrimStrip(props: Props) {
  const { videoMs, trim, disabled } = props;
  const { strip, press, pressStrip, moveTo, release, nudge } = useTrimDrag(props);
  const percent = (ms: number) => `${(ms / videoMs) * 100}%`;
  const tiles = stripTicks(videoMs, STRIP_TILES + 1).slice(0, STRIP_TILES);
  return (
    <div>
      <div
        ref={strip}
        data-testid="sticker-video-tramo"
        onPointerDown={pressStrip}
        onPointerMove={moveTo}
        onPointerUp={release}
        onPointerCancel={release}
        className={`relative flex h-14 touch-none select-none overflow-hidden rounded-xl border border-outline/20 bg-background ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
      >
        {tiles.map((tick) => (
          <span key={tick} className="flex flex-1 items-center justify-center border-r border-outline/10 font-mono text-[11px] text-on-surface-variant last:border-r-0">{clipTime(tick)}</span>
        ))}
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Tramo del sticker"
          aria-valuemin={0}
          aria-valuemax={videoMs}
          aria-valuenow={trim.startMs}
          aria-valuetext={`${clipTime(trim.startMs)} a ${clipTime(trim.endMs)}`}
          onPointerDown={press('move')}
          onKeyDown={nudge('move')}
          className="absolute inset-y-0 cursor-grab rounded-lg border-2 border-primary bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:cursor-grabbing"
          style={{ left: percent(trim.startMs), width: percent(trimLengthMs(trim)) }}
        >
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-on-primary">{clipSeconds(trimLengthMs(trim))} s</span>
          <Handle side="start" label="Inicio del tramo" valueMs={trim.startMs} videoMs={videoMs} disabled={disabled} onPointerDown={press('start')} onKeyDown={nudge('start')} />
          <Handle side="end" label="Fin del tramo" valueMs={trim.endMs} videoMs={videoMs} disabled={disabled} onPointerDown={press('end')} onKeyDown={nudge('end')} />
        </div>
      </div>
      <p className="mt-2 flex items-center justify-between gap-2 text-[13px] text-on-surface-variant">
        <span>Elige hasta 6 segundos</span>
        <span data-testid="sticker-video-tiempos" className="font-mono font-semibold text-on-surface">{clipTime(trim.startMs)} – {clipTime(trim.endMs)}</span>
      </p>
    </div>
  );
}

type HandleProps = { side: 'start' | 'end'; label: string; valueMs: number; videoMs: number; disabled: boolean; onPointerDown: (event: PointerEvent<HTMLElement>) => void; onKeyDown: (event: KeyboardEvent<HTMLElement>) => void };

function Handle({ side, label, valueMs, videoMs, disabled, onPointerDown, onKeyDown }: HandleProps) {
  return (
    <span
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={videoMs}
      aria-valuenow={valueMs}
      aria-valuetext={clipTime(valueMs)}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`absolute inset-y-0 grid w-3 cursor-ew-resize place-items-center bg-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${side === 'start' ? '-left-0.5 rounded-l-md' : '-right-0.5 rounded-r-md'}`}
    >
      <span className="h-5 w-0.5 rounded-full bg-on-primary" />
    </span>
  );
}
