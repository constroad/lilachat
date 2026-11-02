import { createContext, useContext, useEffect, useState } from 'react';
import { Modal as NativeModal, type ModalProps } from 'react-native';
import { openOverlay } from './overlays';
import { beginInteraction, endInteractionAfterPaint } from '../diagnostico/frameMonitor';

/** Every sheet is measured as «abrir-hoja» (plan 1, F0); the photo viewer names its own window. */
const DEFAULT_FRAME_WINDOW = 'abrir-hoja';

const OverlayLevel = createContext(0);
/** Android sends another keyboard event when the modal goes away (~40 ms after, emulator 20/10): still counted until then. */
const RELEASE_AFTER_CLOSE_MS = 400;

/** How many modals contain the component that asks (the thread list: 1). */
export const useOverlayLevel = () => useContext(OverlayLevel);

/**
 * React Native's `Modal` that also counts itself while visible (see
 * `overlays`): the conversation behind it stops following the keyboard.
 *
 * It is shown two frames AFTER it counts itself: the frozen value reaches the
 * UI thread (and the keyboard scroll's derived copy) before Android shows the
 * modal and sends its keyboard event. Shown in the same render, or one render
 * later, the event won the race and the chat still jumped (emulator, 20/10).
 */
export function Modal(props: ModalProps & { frameWindow?: string }) {
  const { frameWindow = DEFAULT_FRAME_WINDOW, onShow, ...modalProps } = props;
  const level = useContext(OverlayLevel);
  const visible = props.visible ?? true;
  const [counted, setCounted] = useState(false);
  useEffect(() => {
    if (!visible) return;
    // From the moment it is asked for until Android shows it: the frames of «abrir-hoja».
    beginInteraction(frameWindow);
    const release = openOverlay();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setCounted(true));
    });
    return () => {
      cancelAnimationFrame(frame);
      setCounted(false);
      setTimeout(release, RELEASE_AFTER_CLOSE_MS);
    };
  }, [visible, frameWindow]);
  const shown = (event: Parameters<NonNullable<ModalProps['onShow']>>[0]) => {
    endInteractionAfterPaint(frameWindow);
    onShow?.(event);
  };
  return (
    <OverlayLevel.Provider value={level + 1}>
      <NativeModal {...modalProps} visible={visible && counted} onShow={shown} />
    </OverlayLevel.Provider>
  );
}
