import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeOut, runOnJS, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Modal } from './Modal';
import { useMargenes } from './useMargenes';
import { backdropOpacity, clampDrag, shouldDismiss } from './overlay/sheetGesture';
import { beginInteraction, endInteractionAfterPaint } from '../diagnostico/frameMonitor';

/**
 * A bottom sheet of the app's own window (plan 1, F1), as Telegram's: a
 * backdrop that fades, a card that slides up, and a finger that drags it down
 * to close. The 32 sheets built as «backdrop Pressable + rounded-t-3xl card»
 * move here one by one; each keeps only its content.
 *
 * `dragArea`: the whole card (default), or only the handle when the content
 * scrolls, so a list inside does not fight the gesture.
 */
const FRAME_WINDOW = 'abrir-hoja';
const BACKDROP_MAX = 0.4;
const BACKDROP_MS = 150;
const SLIDE_MS = 240;
const SNAP_BACK = { damping: 18, stiffness: 200 };
const DRAG_START_PX = 12;
const BOTTOM_ROOM = 16;

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
  /** Padding and the like for the card; the shape and surface are fixed. */
  className?: string;
  dragArea?: 'card' | 'handle';
  /** The tallest it gets (a gallery inside); without it, as tall as its content. */
  maxHeight?: number;
  /** Room under the content, above the system bar; 16 by default. */
  bottomRoom?: number;
  children: ReactNode;
};

/** Closed, a sheet is nothing: no gesture and no animated styles (a chat holds several, and each render paid for them). */
export function Sheet(props: SheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="none" onRequestClose={props.onClose} measured={false}>
      {props.visible ? <SheetBody {...props} /> : null}
    </Modal>
  );
}

/** Mounted on every opening: it starts from rest, with no drag left over. */
function SheetBody(props: SheetProps) {
  const { onClose, dragArea = 'card', maxHeight, bottomRoom = BOTTOM_ROOM } = props;
  const margins = useMargenes();
  const drag = useSharedValue(0);
  const height = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(1, { duration: BACKDROP_MS });
    beginInteraction(FRAME_WINDOW);
  }, [shown]);

  const pan = Gesture.Pan()
    .activeOffsetY([-DRAG_START_PX, DRAG_START_PX])
    .onUpdate((event) => {
      drag.value = clampDrag(event.translationY);
    })
    .onEnd((event) => {
      if (shouldDismiss({ translateY: drag.value, velocityY: event.velocityY, height: height.value })) runOnJS(onClose)();
      else drag.value = withSpring(0, SNAP_BACK);
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.value * backdropOpacity(drag.value, height.value, BACKDROP_MAX) }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const slideIn = SlideInDown.duration(SLIDE_MS).withCallback((finished: boolean) => {
    'worklet';
    if (finished) runOnJS(endInteractionAfterPaint)(FRAME_WINDOW);
  });

  const handle = <View className="h-1.5 w-10 self-center rounded-full bg-outline/30" />;
  const card = (
    <Animated.View
      entering={slideIn}
      exiting={SlideOutDown.duration(SLIDE_MS)}
      style={[cardStyle, { paddingBottom: margins.pie + bottomRoom, ...(maxHeight ? { maxHeight } : {}) }]}
      className={`rounded-t-3xl bg-surface ${props.className ?? ''}`}
      onLayout={(event) => {
        height.value = event.nativeEvent.layout.height;
      }}
      testID={props.testID}
    >
      {dragArea === 'handle' ? (
        <GestureDetector gesture={pan}>
          <View className="items-center py-3">{handle}</View>
        </GestureDetector>
      ) : (
        <View className="items-center pt-3">{handle}</View>
      )}
      {props.children}
    </Animated.View>
  );

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} exiting={FadeOut.duration(BACKDROP_MS)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>
      <View style={styles.bottom} pointerEvents="box-none">
        {dragArea === 'card' ? <GestureDetector gesture={pan}>{card}</GestureDetector> : card}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  bottom: { flex: 1, justifyContent: 'flex-end' },
});
