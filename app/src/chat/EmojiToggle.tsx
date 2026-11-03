import { useEffect } from 'react';
import { BackHandler, Keyboard, Pressable } from 'react-native';
import { Keyboard as KeyboardIcon, Smile } from 'lucide-react-native';
import { closeEmojiPanel, isEmojiPanelOpen, openEmojiPanel, useEmojiPanelOpen } from './emojiPanel';
import { useColores } from '../ui/tema';

/**
 * The emoji / keyboard button of the writing bar, the only part of the bar
 * that listens to the panel (plan 1, F4). In the bar itself, opening or
 * closing the panel re-rendered the whole bar: 2 × 164 ms of JS when sending
 * a wink on the emulator.
 */
export function EmojiToggle(props: { onKeyboard: () => void }) {
  const colors = useColores();
  const open = useEmojiPanelOpen();
  // Back with the panel open closes it, like the keyboard; it does not leave the chat.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeEmojiPanel(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);
  const toggle = () => {
    // To the keyboard: it rises over the panel, which leaves once it is up (`ChatBottom`).
    if (isEmojiPanelOpen()) return props.onKeyboard();
    // From the keyboard: the panel is already whole behind it while it goes down; nothing moves.
    const keyboardUp = Keyboard.isVisible();
    openEmojiPanel(keyboardUp);
    if (keyboardUp) Keyboard.dismiss();
  };
  return (
    <Pressable
      testID="btn-emojis"
      accessibilityLabel={open ? 'Volver al teclado' : 'Emojis'}
      onPress={toggle}
      android_ripple={{ color: colors.outline, borderless: true, radius: 20 }}
      className="h-[46px] w-11 items-center justify-center"
    >
      {open ? <KeyboardIcon size={21} color={colors.outline} /> : <Smile size={21} color={colors.outline} />}
    </Pressable>
  );
}
