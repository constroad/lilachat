import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { ZOOM_CHIPS, nativeZoomOf, zoomFromPinch, zoomLabel } from './zoom';

/** The zoom of a camera as a ratio, the pinch that moves it and the .6x / 1x / 2x chips (José 13/11). */
export function useCameraZoom() {
  const [zoom, setZoom] = useState(1);
  const start = useRef(1);
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      start.current = zoom;
    })
    .onUpdate((event) => setZoom(zoomFromPinch(start.current, event.scale)));
  return { zoom, setZoom, pinch, native: nativeZoomOf(zoom) };
}

/** A column on the right edge, at mid height: clear of the stamp (bottom) and the logo (top). */
export function ZoomChips(props: { zoom: number; onZoom: (zoom: number) => void; right: number }) {
  const active = ZOOM_CHIPS.find((chip) => Math.abs(chip.ratio - props.zoom) < 0.05);
  return (
    <View pointerEvents="box-none" className="absolute flex-col-reverse items-center gap-2" style={{ top: '42%', right: props.right }}>
      {ZOOM_CHIPS.map((chip) => {
        const on = chip === active;
        return (
          <Pressable key={chip.label} testID={`zoom-${chip.label}`} accessibilityLabel={`Zoom ${chip.label}`} onPress={() => props.onZoom(chip.ratio)} className={`h-10 min-w-10 items-center justify-center rounded-full px-2 ${on ? 'bg-on-surface/80' : 'bg-on-surface/40'}`}>
            <Text className={`text-[13px] font-bold ${on ? 'text-warning' : 'text-surface'}`}>{on || chip.ratio !== 1 || active ? chip.label : zoomLabel(props.zoom)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
