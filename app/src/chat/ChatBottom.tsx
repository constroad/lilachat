import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { useKeyboardHandler, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import type { ComposerHandle } from './Composer';
import { EmojiStickerPanel } from './stickers/EmojiStickerPanel';
import { closeEmojiPanel, isEmojiPanelOpen, panelHeight, panelShown, rememberKeyboard, resetEmojiPanel, useEmojiPanelOpen } from './emojiPanel';
import { useMargenes } from '../ui/useMargenes';

/** After entering a chat, when the hidden emoji panel is built (the chat is already on screen). */
const PREMOUNT_MS = 1200;

/**
 * How high the bottom of the conversation goes: the keyboard (as the
 * `KeyboardStickyView` did, with the bar's margin it covers) or the emoji
 * panel, whichever is taller. Read inside each animated style: Reanimated only
 * tracks the `.value` read in the style's own body.
 */
export function useBottomLiftStyle(coveredMargin: number) {
  const { height, progress } = useReanimatedKeyboardAnimation();
  return useAnimatedStyle(() => {
    const keyboard = -height.value - progress.value * coveredMargin;
    const panel = Math.max(0, panelShown.value - coveredMargin);
    return { transform: [{ translateY: -Math.max(keyboard, panel) }] };
  }, [coveredMargin]);
}

/**
 * The bottom of the conversation (José, 20/10: «the emoji panel opens with a
 * bounce»): the bar rides on the keyboard or on the emoji panel, and the panel
 * lies under it as tall as the last keyboard (see `emojiPanel`). It replaces
 * the `KeyboardStickyView`; the bar keeps its place in the layout, so the list
 * never changes size.
 */
export function ChatBottom(props: {
  /** What the bar's bottom margin lets the keyboard cover (`sinSubir`). */
  coveredMargin: number;
  composerRef: RefObject<ComposerHandle | null>;
  chat: { jwt: string; id: string; name: string; withStickers: boolean };
  children: ReactNode;
}) {
  const margins = useMargenes();
  const open = useEmojiPanelOpen();
  // Mounted hidden a moment after entering the chat, and kept: building the emoji grid at the first tap
  // blocked the JS thread and the content followed the panel half a second late (emulator, 20/10).
  const [used, setUsed] = useState(false);
  if (open && !used) setUsed(true);
  useEffect(() => {
    const later = setTimeout(() => setUsed(true), PREMOUNT_MS);
    return () => clearTimeout(later);
  }, []);
  const { coveredMargin } = props;
  const barStyle = useBottomLiftStyle(coveredMargin);
  const height = panelHeight();
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: height - panelShown.value }] }), [height]);

  // A keyboard that finished rising: its height is the panel's from now on, and it takes the panel's place.
  const keyboardUp = (keyboard: number) => {
    rememberKeyboard(keyboard, coveredMargin);
    if (isEmojiPanelOpen()) closeEmojiPanel(true);
  };
  useKeyboardHandler(
    {
      onEnd: (event) => {
        'worklet';
        if (event.height > 0) runOnJS(keyboardUp)(event.height);
      },
    },
    [coveredMargin]
  );
  useEffect(() => resetEmojiPanel, []);

  return (
    <>
      <Animated.View style={barStyle}>{props.children}</Animated.View>
      {used ? (
        <Animated.View testID="zona-panel-emojis" pointerEvents={open ? 'auto' : 'none'} className="absolute bottom-0 left-0 right-0 bg-surface" style={[{ height, paddingBottom: margins.pie }, panelStyle]}>
          <EmojiStickerPanel
            jwt={props.chat.jwt}
            chatId={props.chat.id}
            chatName={props.chat.name}
            withStickers={props.chat.withStickers}
            onPickEmoji={(emoji) => props.composerRef.current?.insertEmoji(emoji)}
            onBackspace={() => props.composerRef.current?.backspace()}
            replyTo={() => props.composerRef.current?.replyingTo()}
            onStickerSent={() => props.composerRef.current?.replyDone()}
          />
        </Animated.View>
      ) : null}
    </>
  );
}
