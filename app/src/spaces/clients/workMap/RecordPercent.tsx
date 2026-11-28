import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { RECORD_PERCENT_LABEL } from '@lilachat/shared';
import { DecimalInput } from '../../../ui/DecimalInput';

const KNOB = 24;
const FULL = 100;
/** One accessibility step of the slider: 5 % of the street. */
const A11Y_STEP = 5;

/** The ring's place as % of the street: a slider and a typed % in one compact row (José 28/11). */
export function RecordPercent(props: { percent: number; onPercent: (percent: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const moveTo = (x: number) => {
    if (trackWidth > 0) props.onPercent(Math.round((Math.min(trackWidth, Math.max(0, x)) / trackWidth) * FULL));
  };
  const drag = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((event) => moveTo(event.x)).onUpdate((event) => moveTo(event.x));
  const knobLeft = (props.percent / FULL) * trackWidth - KNOB / 2;
  const step = (sign: number) => props.onPercent(Math.min(FULL, Math.max(0, props.percent + sign * A11Y_STEP)));
  return (
    <View className="flex-row items-center gap-2">
      <GestureDetector gesture={drag}>
        <View testID="avance-porcentaje-slider" accessibilityRole="adjustable" accessibilityLabel={RECORD_PERCENT_LABEL} accessibilityValue={{ min: 0, max: FULL, now: props.percent }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)} onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)} className="h-11 flex-1 justify-center">
          <View pointerEvents="none" className="h-1.5 overflow-hidden rounded-full bg-surface-variant">
            <View className="h-full bg-primary" style={{ width: `${props.percent}%` }} />
          </View>
          <View pointerEvents="none" className="absolute rounded-full border-2 border-primary bg-surface" style={{ left: knobLeft, width: KNOB, height: KNOB }} />
        </View>
      </GestureDetector>
      <View className="h-11 flex-row items-center gap-1 rounded-xl border border-outline/25 bg-surface px-2">
        <DecimalInput testID="avance-porcentaje" accessibilityLabel={RECORD_PERCENT_LABEL} selectTextOnFocus value={props.percent} onValue={(value) => { if (value !== null) props.onPercent(value); }} className="w-14 text-right text-[15px] font-semibold text-on-surface" />
        <Text className="text-[15px] font-semibold text-on-surface">%</Text>
      </View>
    </View>
  );
}
