import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

type FingerEvent = { nativeEvent: { locationX: number; locationY: number } };
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { hexToHsv, hsvToHex, unitAt, type Hsv } from '@lilachat/shared';

const SQUARE_HEIGHT = 160;
const HUE_HEIGHT = 28;
const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360];
const START_COLOR: Hsv = { h: 262, s: 0.75, v: 0.8 };

/** A finger dragged on a box: the box keeps the touch while the finger moves (a sheet must not scroll away). */
function useDragBox(onUnit: (x: number, y: number) => void) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const at = (event: FingerEvent) => onUnit(unitAt(event.nativeEvent.locationX, size.width), unitAt(event.nativeEvent.locationY, size.height));
  return {
    onLayout: (event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height }),
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: at,
    onResponderMove: at,
    size,
  };
}

/** A free color (José 27/11): saturation and brightness in the square, hue in the bar under it. */
export function ColorPicker(props: { value: string; onChange: (hex: string) => void; testID?: string }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(props.value) ?? START_COLOR);
  const pick = (next: Hsv) => {
    setHsv(next);
    props.onChange(hsvToHex(next));
  };
  const square = useDragBox((x, y) => pick({ ...hsv, s: x, v: 1 - y }));
  const hue = useDragBox((x) => pick({ ...hsv, h: x * 360 }));
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  return (
    <View testID={props.testID} className="mt-2 gap-2">
      <View {...square} testID={props.testID ? `${props.testID}-tono` : undefined} style={{ height: SQUARE_HEIGHT }} className="overflow-hidden rounded-xl">
        <Svg width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="white" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#ffffff" stopOpacity={1} /><Stop offset="1" stopColor="#ffffff" stopOpacity={0} /></LinearGradient>
            <LinearGradient id="black" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000000" stopOpacity={0} /><Stop offset="1" stopColor="#000000" stopOpacity={1} /></LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={pure} />
          <Rect width="100%" height="100%" fill="url(#white)" />
          <Rect width="100%" height="100%" fill="url(#black)" />
        </Svg>
        <View pointerEvents="none" className="absolute h-6 w-6 rounded-full border-2 border-white" style={{ left: hsv.s * square.size.width - 12, top: (1 - hsv.v) * square.size.height - 12 }} />
      </View>
      <View {...hue} testID={props.testID ? `${props.testID}-matiz` : undefined} style={{ height: HUE_HEIGHT }} className="overflow-hidden rounded-full">
        <Svg width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
              {HUE_STOPS.map((degrees) => <Stop key={degrees} offset={degrees / 360} stopColor={hsvToHex({ h: degrees, s: 1, v: 1 })} />)}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hue)" />
        </Svg>
        <View pointerEvents="none" className="absolute top-0 h-full w-2 rounded-full border-2 border-white" style={{ left: (hsv.h / 360) * hue.size.width - 4 }} />
      </View>
      <View className="flex-row items-center gap-2">
        <View className="h-6 w-6 rounded-full border border-outline/40" style={{ backgroundColor: hsvToHex(hsv) }} />
        <Text className="font-mono text-[13px] text-on-surface-variant">{hsvToHex(hsv)}</Text>
      </View>
    </View>
  );
}
