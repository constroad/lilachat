import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { activeZoomChip, sliderToZoom, zoomChipsFor, zoomFromPinch, zoomLabel, zoomToSlider, type ZoomRange } from '@lilachat/shared';

/**
 * Zoom of the web camera (José 25/11: like Samsung's camera): the chips this lens reaches, a slider
 * that opens on a long press or a pinch, and the pinch itself. The math is `@lilachat/shared`
 * (`cameraZoom.ts`, shared with the APK); the lens range is the browser's.
 */
type Lens = { range: ZoomRange | null; zoom: number; setZoom: (ratio: number) => void };
type Slider = ReturnType<typeof useZoomSlider>;

const SLIDER_HIDE_MS = 2000;
const LONG_PRESS_MS = 350;
/** The range input's steps: fine enough for 0.1x near 1x on a 100x lens. */
const SLIDER_STEPS = 1000;

/** Shown while it is being used, gone SLIDER_HIDE_MS after the last touch. */
export function useZoomSlider() {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const show = () => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), SLIDER_HIDE_MS);
  };
  return { visible, show };
}

const spanOf = (event: TouchEvent) => {
  const [a, b] = [event.touches[0], event.touches[1]];
  return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
};

/** Two fingers on the picture zoom it, and show the slider while they do. */
export function usePinchZoom(lens: Lens, slider: Slider) {
  const start = useRef<{ span: number; zoom: number } | null>(null);
  return {
    onTouchStart: (event: TouchEvent) => {
      if (event.touches.length === 2) start.current = { span: spanOf(event), zoom: lens.zoom };
    },
    onTouchMove: (event: TouchEvent) => {
      const began = start.current;
      const span = spanOf(event);
      if (!began || !lens.range || !span || !began.span) return;
      lens.setZoom(zoomFromPinch(began.zoom, span / began.span, lens.range));
      slider.show();
    },
    onTouchEnd: () => {
      start.current = null;
    },
  };
}

/** Right edge, a bit above the middle (as the APK): the chips, or the slider while it is in use. */
export function ZoomColumn(props: { lens: Lens; slider: Slider }) {
  const { range } = props.lens;
  const chips = zoomChipsFor(range);
  if (!range || !chips.length) return null;
  return (
    <div data-testid="zoom-camara" className="absolute right-4 top-[26%] flex flex-col items-center">
      {props.slider.visible ? <ZoomSlider lens={props.lens} range={range} slider={props.slider} /> : <ChipColumn lens={props.lens} chips={chips} slider={props.slider} />}
    </div>
  );
}

function ChipColumn(props: { lens: Lens; chips: ReturnType<typeof zoomChipsFor>; slider: Slider }) {
  const active = activeZoomChip(props.chips, props.lens.zoom);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const release = () => void (press.current && clearTimeout(press.current));
  useEffect(() => release, []);
  return (
    <div className="flex flex-col-reverse items-center gap-2">
      {props.chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          data-testid={`zoom-${chip.label}`}
          aria-pressed={chip === active}
          title="Mantén presionado para ajustar"
          onClick={() => props.lens.setZoom(chip.ratio)}
          onPointerDown={() => (release(), (press.current = setTimeout(props.slider.show, LONG_PRESS_MS)))}
          onPointerUp={release}
          onPointerLeave={release}
          onContextMenu={(event) => event.preventDefault()}
          className={`grid h-10 min-w-10 select-none place-items-center rounded-full px-2 text-[13px] font-bold ${chip === active ? 'bg-black/80 text-warning' : 'bg-black/45 text-white'}`}
        >
          {!active && chip.ratio === 1 ? zoomLabel(props.lens.zoom) : chip.label}
        </button>
      ))}
    </div>
  );
}

/** Vertical, the closest zoom on top; logarithmic, like the phone's. */
function ZoomSlider(props: { lens: Lens; range: ZoomRange; slider: Slider }) {
  const position = Math.round(zoomToSlider(props.lens.zoom, props.range) * SLIDER_STEPS);
  return (
    <div className="flex flex-col items-center gap-2">
      <span data-testid="zoom-lectura" className="rounded-full bg-black/80 px-3 py-1 text-[14px] font-bold text-warning">{zoomLabel(props.lens.zoom)}</span>
      <span className="text-[11px] font-semibold">{zoomLabel(props.range.max)}</span>
      <input
        type="range"
        data-testid="zoom-slider"
        aria-label="Zoom"
        min={0}
        max={SLIDER_STEPS}
        value={position}
        onChange={(event) => (props.lens.setZoom(sliderToZoom(Number(event.target.value) / SLIDER_STEPS, props.range)), props.slider.show())}
        onPointerDown={props.slider.show}
        className="h-60 w-11 cursor-pointer accent-warning [direction:rtl] [writing-mode:vertical-lr]"
      />
      <span className="text-[11px] font-semibold">{zoomLabel(props.range.min)}</span>
    </div>
  );
}
