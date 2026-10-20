import { forwardRef, useMemo, useState, type ComponentRef } from 'react';
import type { LayoutChangeEvent, ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';

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
        const { onLayout } = props;
        const alMedir = (evento: LayoutChangeEvent) => {
          setMedido(true);
          onLayout?.(evento);
        };
        return <KeyboardChatScrollView ref={ref} {...props} onLayout={alMedir} freeze={!medido} offset={sinSubir} keyboardLiftBehavior="always" />;
      }),
    [sinSubir]
  );
}
