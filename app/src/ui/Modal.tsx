import { createContext, useContext, useEffect, useState } from 'react';
import { Modal as NativeModal, type ModalProps } from 'react-native';
import { openOverlay } from './overlays';

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
export function Modal(props: ModalProps) {
  const level = useContext(OverlayLevel);
  const visible = props.visible ?? true;
  const [counted, setCounted] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const release = openOverlay();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setCounted(true));
    });
    return () => {
      cancelAnimationFrame(frame);
      setCounted(false);
      setTimeout(release, RELEASE_AFTER_CLOSE_MS);
    };
  }, [visible]);
  return (
    <OverlayLevel.Provider value={level + 1}>
      <NativeModal {...props} visible={visible && counted} />
    </OverlayLevel.Provider>
  );
}
