import { useEffect, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, View, useWindowDimensions, type DimensionValue } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { Easing, FadeOut, runOnJS, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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
  maxHeight?: DimensionValue;
  /** One height whatever it holds: a search list that must not jump while typing. */
  height?: DimensionValue;
  /** Room under the content, above the system bar; 16 by default. */
  bottomRoom?: number;
  /** The back button, when it does not simply close: a typed text is not thrown away. */
  onBack?: () => void;
  /** In the window's layer, not the screen's: the chat's layer reaches under Android's buttons (José 13/11). */
  fullWindow?: boolean;
  /**
   * `dismiss` (default): it closes the keyboard, which would cover it: the card lives in the app's window.
   * `avoid`: a sheet with a text field rises with it. `keep`: a search that opens it and keeps its height.
   */
  keyboard?: 'dismiss' | 'avoid' | 'keep';
  /** `background` for a sheet of cards. */
  tone?: 'surface' | 'background';
  children: ReactNode;
};

/** Closed, a sheet is nothing: no gesture and no animated styles (a chat holds several, and each render paid for them). */
export function Sheet(props: SheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="none" onRequestClose={props.onBack ?? props.onClose} measured={false} fullWindow={props.fullWindow}>
      {props.visible ? <SheetBody {...props} /> : null}
    </Modal>
  );
}

/** Mounted on every opening: it starts from rest, with no drag left over. */
function SheetBody(props: SheetProps) {
  const { onClose, dragArea = 'card', maxHeight, height: fixedHeight, bottomRoom = BOTTOM_ROOM, keyboard = 'dismiss', tone = 'surface' } = props;
  const margins = useMargenes();
  const drag = useSharedValue(0);
  const height = useSharedValue(0);
  const shown = useSharedValue(0);
  // José 13/11: the entry is our own value, not a layout animation. A sheet that re-renders while it
  // slides in (the clip loading the gallery) was left halfway down, its last row under Android's buttons.
  const { height: windowHeight } = useWindowDimensions();
  const entry = useSharedValue(1);

  useEffect(() => {
    shown.value = withTiming(1, { duration: BACKDROP_MS });
    entry.value = withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(endInteractionAfterPaint)(FRAME_WINDOW);
    });
    beginInteraction(FRAME_WINDOW);
    if (keyboard === 'dismiss') Keyboard.dismiss();
  }, [shown, entry, keyboard]);

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
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value + entry.value * windowHeight }] }));

  const handle = <View className="h-1.5 w-10 self-center rounded-full bg-outline/30" />;
  const card = (
    <Animated.View
      exiting={SlideOutDown.duration(SLIDE_MS)}
      style={[cardStyle, { paddingBottom: margins.pie + bottomRoom, ...(maxHeight ? { maxHeight } : {}), ...(fixedHeight ? { height: fixedHeight } : {}) }]}
      className={`rounded-t-3xl ${tone === 'surface' ? 'bg-surface' : 'bg-background'} ${props.className ?? ''}`}
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

  const draggable = dragArea === 'card' ? <GestureDetector gesture={pan}>{card}</GestureDetector> : card;
  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} exiting={FadeOut.duration(BACKDROP_MS)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>
      {keyboard === 'avoid' ? (
        <KeyboardAvoidingView behavior="padding" style={styles.bottom} pointerEvents="box-none">
          {draggable}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.bottom} pointerEvents="box-none">
          {draggable}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  bottom: { flex: 1, justifyContent: 'flex-end' },
});
