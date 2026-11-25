import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { activeZoomChip, clampZoom, sliderToZoom, zoomChipsFor, zoomFromPinch, zoomLabel, zoomToSlider, type ZoomRange } from '@lilachat/shared';
import { FALLBACK_RANGE, nativeZoomOf, zoomRangeOf } from './zoom';

/** The slider hides this long after the last touch, as Samsung's. */
const SLIDER_HIDE_MS = 2000;
/** A long press on a chip opens the slider. */
const LONG_PRESS_MS = 350;
/** The slider's track: tall enough to aim at 30x, short enough to clear the stamp. */
const TRACK_HEIGHT = 240;
const KNOB = 28;
/** The column sits a bit above the middle: clear of the logo (top) and the stamp (bottom). */
const COLUMN_TOP = '26%';

/** Shown while it is being used, gone SLIDER_HIDE_MS after the last touch. */
function useSliderVisibility() {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = () => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), SLIDER_HIDE_MS);
  };
  return { visible, show };
}

/** The zoom of a camera as a ratio within its lens's range, the pinch that moves it, and the slider (José 25/11). */
export function useCameraZoom() {
  const [zoom, setZoomState] = useState(1);
  const [range, setRange] = useState<ZoomRange>(FALLBACK_RANGE);
  const slider = useSliderVisibility();
  const start = useRef(1);
  const setZoom = (ratio: number) => setZoomState(clampZoom(ratio, range));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      start.current = zoom;
      slider.show();
    })
    .onUpdate((event) => {
      setZoomState(zoomFromPinch(start.current, event.scale, range));
      slider.show();
    });
  // The patched expo-camera says the lens's range when it opens (again after flipping to the selfie lens).
  const onReady = (event?: { minZoom?: unknown; maxZoom?: unknown }) => {
    const said = zoomRangeOf(event);
    if (!said) return;
    setRange(said);
    setZoomState((before) => clampZoom(before, said));
  };
  return { zoom, setZoom, range, pinch, onReady, slider, native: nativeZoomOf(zoom) };
}
export type CameraZoom = ReturnType<typeof useCameraZoom>;

/** A column on the right edge: the chips this lens reaches, or the slider while it is in use. */
export function ZoomChips(props: { zoom: CameraZoom; right: number }) {
  const { zoom } = props;
  const chips = zoomChipsFor(zoom.range);
  if (!chips.length) return null;
  return (
    <View pointerEvents="box-none" className="absolute items-center" style={{ top: COLUMN_TOP, right: props.right }}>
      {zoom.slider.visible ? <ZoomSlider zoom={zoom} /> : <ChipColumn zoom={zoom} chips={chips} />}
    </View>
  );
}

function ChipColumn(props: { zoom: CameraZoom; chips: ReturnType<typeof zoomChipsFor> }) {
  const { zoom } = props;
  const active = activeZoomChip(props.chips, zoom.zoom);
  return (
    <View testID="zoom-camara" className="flex-col-reverse items-center gap-2">
      {props.chips.map((chip) => {
        const on = chip === active;
        // Between two chips, the 1x chip says the real ratio (as the phone's camera).
        const label = !active && chip.ratio === 1 ? zoomLabel(zoom.zoom) : chip.label;
        return (
          <Pressable key={chip.label} testID={`zoom-${chip.label}`} accessibilityLabel={`Zoom ${chip.label}. Mantén presionado para ajustar.`} onPress={() => zoom.setZoom(chip.ratio)} onLongPress={zoom.slider.show} delayLongPress={LONG_PRESS_MS} className={`h-10 min-w-10 items-center justify-center rounded-full px-2 ${on ? 'bg-on-surface/80' : 'bg-on-surface/40'}`}>
            <Text className={`text-[13px] font-bold ${on ? 'text-warning' : 'text-surface'}`}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Vertical, the closest zoom on top: dragging anywhere on the track moves the zoom live. */
function ZoomSlider(props: { zoom: CameraZoom }) {
  const { zoom } = props;
  const moveTo = (y: number) => {
    zoom.setZoom(sliderToZoom(1 - y / TRACK_HEIGHT, zoom.range));
    zoom.slider.show();
  };
  const drag = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((event) => moveTo(event.y)).onUpdate((event) => moveTo(event.y));
  const knobTop = (1 - zoomToSlider(zoom.zoom, zoom.range)) * TRACK_HEIGHT - KNOB / 2;
  return (
    <View testID="zoom-slider" className="items-center gap-2">
      <View className="rounded-full bg-on-surface/80 px-3 py-1">
        <Text testID="zoom-lectura" className="text-[14px] font-bold text-warning">{zoomLabel(zoom.zoom)}</Text>
      </View>
      <Text className="text-[11px] font-semibold text-surface">{zoomLabel(zoom.range.max)}</Text>
      <GestureDetector gesture={drag}>
        <View accessibilityRole="adjustable" accessibilityLabel={`Zoom ${zoomLabel(zoom.zoom)}`} className="w-11 items-center rounded-full bg-on-surface/40" style={{ height: TRACK_HEIGHT }}>
          <View pointerEvents="none" className="absolute bottom-0 top-0 w-[3px] bg-surface/60" />
          <View pointerEvents="none" className="absolute rounded-full border-2 border-warning bg-surface" style={{ top: knobTop, width: KNOB, height: KNOB }} />
        </View>
      </GestureDetector>
      <Text className="text-[11px] font-semibold text-surface">{zoomLabel(zoom.range.min)}</Text>
    </View>
  );
}
