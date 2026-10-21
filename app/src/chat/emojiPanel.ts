import { useSyncExternalStore } from 'react';
import { Easing, makeMutable, withTiming } from 'react-native-reanimated';

/**
 * The emoji panel takes the keyboard's place, like WhatsApp (José, 20/10:
 * «when it opens there is a bounce or double flicker»). It used to open in the
 * layout under the bar: the conversation shrank at once and, coming from the
 * keyboard, the bar first jumped up by the panel and then went down with the
 * closing keyboard.
 *
 * Now the panel sits under the bar, as tall as the last keyboard:
 * - `panelShown`: its visible height (UI thread); the bar rises by the larger of keyboard and panel.
 * - `roomHeld`: the list's room for it (`blankSpace` of the keyboard scroll, in
 *   «persistent» mode): a keyboard that comes or goes behind the panel moves nothing.
 * - Opening without keyboard, the room is there first and `contentLift` goes
 *   from 0 to the room with the panel: the list scrolls to «offset at the start
 *   + lift» frame by frame on the UI thread (`useScrollConTeclado`), like the
 *   keyboard does. Growing the padding and scrolling by increments got clamped
 *   (+59 dp of 340), and FlashList's own offset was stale (emulator, 20/10).
 *   Closing, the room shrinks with the panel and the native list brings the
 *   content down by itself; reading above, nothing moves.
 * One conversation at a time: module state.
 */
const MOVE_MS = 250;
const EASING = Easing.out(Easing.cubic);
/** Until a keyboard has been seen, the panel is this tall (dp). */
const DEFAULT_PANEL_HEIGHT = 340;
/** A shorter «keyboard» is a toolbar (stylus, physical or floating keyboard): it does not size the panel (emulator, 20/10: 60 dp). */
const MIN_KEYBOARD_HEIGHT = 200;

type Listener = () => void;
let open = false;
let keyboardHeight = 0;
/** What the bar's bottom margin lets the keyboard cover (`sinSubir`): the room is the panel minus that. */
let coveredMargin = 0;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

export const panelShown = makeMutable(0);
export const roomHeld = makeMutable(0);

/** How much the content has gone up with the panel in this opening (0 between openings). */
export const contentLift = makeMutable(0);

/** The panel is as tall as the last keyboard: switching between them moves nothing. */
export const panelHeight = () => (keyboardHeight >= MIN_KEYBOARD_HEIGHT ? keyboardHeight : DEFAULT_PANEL_HEIGHT);
export function rememberKeyboard(height: number, margin: number) {
  if (height > 0) keyboardHeight = height;
  coveredMargin = margin;
}
const room = () => Math.max(0, panelHeight() - coveredMargin);

function setOpen(next: boolean) {
  if (open === next) return;
  open = next;
  notify();
}
export const isEmojiPanelOpen = () => open;

/** Opens it. Behind a keyboard that is up: whole and at once (the keyboard covers it while it leaves). */
export function openEmojiPanel(keyboardUp: boolean) {
  const target = room();
  roomHeld.value = target;
  if (keyboardUp) panelShown.value = panelHeight();
  else {
    panelShown.value = withTiming(panelHeight(), { duration: MOVE_MS, easing: EASING });
    contentLift.value = withTiming(target, { duration: MOVE_MS, easing: EASING }, () => {
      'worklet';
      // Back to 0 without scrolling: the next opening starts from where the list is then.
      contentLift.value = 0;
    });
  }
  setOpen(true);
}

/** Closes it. Behind the keyboard that just rose: at once (its room is the keyboard's now). Otherwise sliding down. */
export function closeEmojiPanel(keyboardUp: boolean) {
  if (keyboardUp) {
    panelShown.value = 0;
    roomHeld.value = 0;
  } else {
    panelShown.value = withTiming(0, { duration: MOVE_MS, easing: EASING });
    // Frame by frame with the panel: at the end the native list follows down; reading above, nothing moves.
    roomHeld.value = withTiming(0, { duration: MOVE_MS, easing: EASING });
  }
  setOpen(false);
}

/** Leaving the chat: closed, without room, without animation. */
export function resetEmojiPanel() {
  panelShown.value = 0;
  roomHeld.value = 0;
  setOpen(false);
}

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useEmojiPanelOpen = () => useSyncExternalStore(subscribe, () => open, () => open);

