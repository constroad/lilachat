import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ForwardedRef } from 'react';
import { Keyboard, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import Reanimated, { makeMutable, scrollTo, useAnimatedReaction, useAnimatedRef, useScrollViewOffset, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useOverlayLevel } from '../ui/Modal';
import { coveredAbove, subscribeOverlays } from '../ui/overlays';

const NO_ROOM = makeMutable(0);
/**
 * Room that something other than the keyboard takes under the list (the emoji
 * panel, `emojiPanel`): `held` stays while a keyboard comes or goes behind it,
 * without moving anything; `lift` is how much the content goes up while it
 * appears. Without a provider (the thread), none.
 */
export const BottomRoom = createContext<{ held: SharedValue<number>; lift: SharedValue<number> }>({ held: NO_ROOM, lift: NO_ROOM });

type ScrollRef = ComponentRef<typeof KeyboardChatScrollView>;

/**
 * The content goes up with the emoji panel like with the keyboard: «offset at
 * the start + lift», absolute, on the UI thread (an increment per frame read a
 * stale offset and ended short). Gives the ref to put on the scroll.
 */
function useFollowLift(lift: SharedValue<number>, forwarded: ForwardedRef<ScrollRef>) {
  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const offset = useScrollViewOffset(scrollRef);
  const start = useSharedValue(0);
  useAnimatedReaction(
    () => lift.value,
    (current, previous) => {
      if (previous === null || current <= 0) return;
      if (previous <= 0) start.value = offset.value;
      scrollTo(scrollRef, 0, start.value + current, false);
    }
  );
  return useCallback(
    (node: ScrollRef | null) => {
      scrollRef(node as Reanimated.ScrollView | null);
      if (typeof forwarded === 'function') forwarded(node);
      else if (forwarded) forwarded.current = node;
    },
    [scrollRef, forwarded]
  );
}

/**
 * El scroll de una conversación que sigue al teclado como Telegram (20/10): la
 * lista NO cambia de tamaño; su padding y su desplazamiento acompañan al
 * teclado cuadro a cuadro en el hilo de UI. Con un `KeyboardAvoidingView`
 * quedaba un salto y un rebote al abrir y cerrar.
 *
 * `sinSubir`: lo que la barra de escribir sube MENOS que el teclado (su margen
 * de la barra de navegación, que el teclado tapa). Va como `renderScrollComponent`
 * de la lista; la barra, en un `KeyboardStickyView` con el mismo valor.
 */
export function useScrollConTeclado(sinSubir: number) {
  // Read through a ref: the margin resolves a moment after mounting (16 → 24 dp) and a new component
  // type remounted the scroll under the list, which then jumped (José, 21/10: «el salto al abrir»).
  const latestOffset = useRef(sinSubir);
  latestOffset.current = sinSubir;
  return useMemo(
    () =>
      forwardRef<ComponentRef<typeof KeyboardChatScrollView>, ScrollViewProps>(function ScrollConTeclado(props, ref) {
        // Congelado hasta medirse: al montarse dentro de un Modal (el hilo) llega un
        // evento del teclado antes de que la vista exista y Reanimated avisaba
        // «scrollTo with an uninitialized ref».
        const [medido, setMedido] = useState(false);
        // Read here, inside the list: the thread's list lives inside its modal (level 1).
        const covered = useFrozenWhileCovered();
        const room = useContext(BottomRoom);
        const setRef = useFollowLift(room.lift, ref);
        const { onLayout } = props;
        const alMedir = (evento: LayoutChangeEvent) => {
          setMedido(true);
          onLayout?.(evento);
        };
        // «persistent»: a keyboard that goes away keeps the reading position (at the end it follows down),
        // and a keyboard that comes or goes behind the emoji panel moves nothing (20/10).
        return <KeyboardChatScrollView {...props} onLayout={alMedir} freeze={medido ? covered : true} offset={latestOffset.current} keyboardLiftBehavior="persistent" blankSpace={room.held} ref={setRef} />;
      }),
    []
  );
}

/**
 * Frozen while a modal covers the list and the keyboard is down (José, 20/10:
 * coming back from a thread landed at the start of the chat; see `overlays`).
 * With the keyboard up when the modal opens, its real close is still followed
 * (otherwise its space stays empty) and the list freezes once it is down.
 */
function useFrozenWhileCovered(): SharedValue<boolean> {
  const level = useOverlayLevel();
  const frozen = useSharedValue(false);
  useEffect(() => {
    const update = () => {
      frozen.value = coveredAbove(level) && !Keyboard.isVisible();
    };
    const leave = subscribeOverlays(update);
    const hidden = Keyboard.addListener('keyboardDidHide', update);
    update();
    return () => {
      leave();
      hidden.remove();
    };
  }, [frozen, level]);
  return frozen;
}
