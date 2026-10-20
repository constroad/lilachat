import { forwardRef, useEffect, useMemo, useState, type ComponentRef } from 'react';
import { Keyboard, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useOverlayLevel } from '../ui/Modal';
import { coveredAbove, subscribeOverlays } from '../ui/overlays';

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
  return useMemo(
    () =>
      forwardRef<ComponentRef<typeof KeyboardChatScrollView>, ScrollViewProps>(function ScrollConTeclado(props, ref) {
        // Congelado hasta medirse: al montarse dentro de un Modal (el hilo) llega un
        // evento del teclado antes de que la vista exista y Reanimated avisaba
        // «scrollTo with an uninitialized ref».
        const [medido, setMedido] = useState(false);
        // Read here, inside the list: the thread's list lives inside its modal (level 1).
        const covered = useFrozenWhileCovered();
        const { onLayout } = props;
        const alMedir = (evento: LayoutChangeEvent) => {
          setMedido(true);
          onLayout?.(evento);
        };
        return <KeyboardChatScrollView ref={ref} {...props} onLayout={alMedir} freeze={medido ? covered : true} offset={sinSubir} keyboardLiftBehavior="always" />;
      }),
    [sinSubir]
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
