import { useCallback, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import { KeyboardGestureArea, useKeyboardHandler, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import type { WinkId } from '@lilachat/shared';
import type { ComposerHandle } from './Composer';
import { EmojiStickerPanel } from './stickers/EmojiStickerPanel';
import { closeEmojiPanel, isEmojiPanelOpen, panelHeight, panelShown, rememberKeyboard, resetEmojiPanel, useEmojiPanelOpen } from './emojiPanel';
import { useMargenes } from '../ui/useMargenes';
import { useOverlayLevel } from '../ui/Modal';
import { coveredAbove } from '../ui/overlays';

/** After entering a chat, when the hidden emoji panel is built (the chat is already on screen). */
const PREMOUNT_MS = 1200;
/** The writing bar over the keyboard (48 dp pill and its padding): a finger that reaches it starts moving the keyboard. */
const WRITING_BAR_DP = 60;

/**
 * Plan 1, F3: the keyboard closes by dragging the conversation down, like
 * Telegram on iPhone. The list scrolls with the finger as always; once the
 * finger reaches the bar, the keyboard follows it, and letting go closes it or
 * sends it back up. The scroll keeps the reading position (`persistent`).
 * Android 11+; on iPhone it is the scroll's `keyboardDismissMode` (plan 2).
 */
export function ChatKeyboardArea(props: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  if (Platform.OS !== 'android') return <View style={props.style}>{props.children}</View>;
  return (
    <KeyboardGestureArea style={props.style} interpolator="ios" offset={WRITING_BAR_DP} testID="zona-teclado">
      {props.children}
    </KeyboardGestureArea>
  );
}

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
  chat: { jwt: string; id: string; name: string; withStickers: boolean; onWink?: (wink: WinkId) => void; onNudge?: () => void };
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
  const { coveredMargin, composerRef } = props;
  // Stable, so the memoized panel does not redraw when the panel opens or closes, nor with each message (F4, 02/11).
  const pickEmoji = useCallback((emoji: string) => composerRef.current?.insertEmoji(emoji), [composerRef]);
  const backspace = useCallback(() => composerRef.current?.backspace(), [composerRef]);
  const replyTo = useCallback(() => composerRef.current?.replyingTo(), [composerRef]);
  const stickerSent = useCallback(() => composerRef.current?.replyDone(), [composerRef]);
  const barStyle = useBottomLiftStyle(coveredMargin);
  const height = panelHeight();
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: height - panelShown.value }] }), [height]);

  const level = useOverlayLevel();
  // A keyboard that finished rising: its height is the panel's from now on, and it takes the panel's place.
  // Not a keyboard of a screen on top (the full-screen GIF search, pending 59): coming back, the panel is still there.
  const keyboardUp = (keyboard: number) => {
    if (coveredAbove(level)) return;
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
            onPickEmoji={pickEmoji}
            onBackspace={backspace}
            replyTo={replyTo}
            onStickerSent={stickerSent}
            onWink={props.chat.onWink}
            onNudge={props.chat.onNudge}
          />
        </Animated.View>
      ) : null}
    </>
  );
}
