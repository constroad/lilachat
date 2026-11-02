import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, type ModalProps } from 'react-native';
import Animated, { FadeIn, FadeOut, runOnJS, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { newOverlayId, type OverlayHostHandle } from './OverlayHost';
import { useContextBridge } from './contextBridge';

/**
 * `Modal` drawn by an `OverlayHost` instead of a second window (plan 1, F1).
 * Same contract the 86 call sites already use: `visible`, `animationType`,
 * `onRequestClose` (the back button), `onShow`, `testID`. The children are
 * handed to the host, which draws them over the screen in the app's window.
 */
const FADE_MS = 150;
const SLIDE_MS = 240;
/** Above anything the screen draws with its own elevation (the chat header uses 2). */
const LAYER_ELEVATION = 100;
/** The back button carries no native event here; callers only ever close. */
const BACK_EVENT = { nativeEvent: {} } as Parameters<NonNullable<ModalProps['onRequestClose']>>[0];

type Props = Pick<ModalProps, 'visible' | 'animationType' | 'onRequestClose' | 'testID'> & {
  host: OverlayHostHandle;
  onShown?: () => void;
  children?: ReactNode;
};

export function OverlayModal(props: Props) {
  const { host, visible, animationType, onRequestClose, onShown, testID, children } = props;
  const id = useRef(newOverlayId()).current;
  // The host is higher in the tree: the providers between it and here travel with the layer.
  const bridge = useContextBridge();
  // The host keeps a snapshot of the callbacks; the latest render's ones answer.
  const latest = useRef({ onRequestClose, onShown });
  latest.current = { onRequestClose, onShown };

  useEffect(() => {
    if (!visible) {
      host.unmount(id);
      return;
    }
    host.mount(
      id,
      <Layer key={id} animationType={animationType} testID={testID} onShown={() => latest.current.onShown?.()}>
        {bridge(children)}
      </Layer>,
      () => latest.current.onRequestClose?.(BACK_EVENT)
    );
  });

  useEffect(() => () => host.unmount(id), [host, id]);

  return null;
}

type Shown = () => void;

function enteringFor(animationType: ModalProps['animationType'], onShown: Shown) {
  const done = (finished: boolean) => {
    'worklet';
    if (finished) runOnJS(onShown)();
  };
  if (animationType === 'slide') return SlideInDown.duration(SLIDE_MS).withCallback(done);
  if (animationType === 'fade') return FadeIn.duration(FADE_MS).withCallback(done);
  return undefined;
}

function exitingFor(animationType: ModalProps['animationType']) {
  if (animationType === 'slide') return SlideOutDown.duration(SLIDE_MS);
  if (animationType === 'fade') return FadeOut.duration(FADE_MS);
  return undefined;
}

function Layer(props: { animationType: ModalProps['animationType']; testID?: string; onShown: Shown; children?: ReactNode }) {
  const { animationType, onShown } = props;
  const entering = useRef(enteringFor(animationType, onShown)).current;
  const exiting = useRef(exitingFor(animationType)).current;
  useEffect(() => {
    // Only at mount: what «shown» means is the first paint.
    if (!entering) onShown();
  }, []);
  return (
    <Animated.View style={styles.layer} entering={entering} exiting={exiting} testID={props.testID} pointerEvents="box-none">
      {props.children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: LAYER_ELEVATION, elevation: LAYER_ELEVATION },
});
