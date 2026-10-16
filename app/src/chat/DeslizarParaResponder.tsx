import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CornerUpLeft } from 'lucide-react-native';
import { useColores } from '../ui/tema';
import { cruzoElUmbral, desplazamientoVisible, UMBRAL_RESPUESTA } from './gestoDeRespuesta';

/** Cuánto hay que moverse en horizontal antes de que el gesto se active (dp). */
const ARRANQUE_HORIZONTAL = 12;
/** Un movimiento vertical mayor que esto es scroll: el gesto se suelta (dp). */
const TOLERANCIA_VERTICAL = 14;

function vibrarSuave(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Deslizar el mensaje a la derecha para responderlo, como WhatsApp (FL2b).
 *
 * Antes era `PanResponder` en el hilo de JS: competía con el scroll de la
 * lista y la burbuja seguía al dedo a saltos cuando el hilo estaba ocupado.
 * Con gesture-handler + Reanimated el arrastre corre en el hilo de UI; solo el
 * «responder» cruza a JS. Un tick háptico marca el momento en que soltar ya
 * responde, que es lo que hace sentir el gesto.
 */
export function DeslizarParaResponder({
  habilitado,
  onResponder,
  children,
}: {
  habilitado: boolean;
  onResponder: () => void;
  children: ReactNode;
}) {
  const colores = useColores();
  const dx = useSharedValue(0);

  // El tick al CRUZAR el umbral (no al soltar): avisa que ya alcanza.
  useAnimatedReaction(
    () => cruzoElUmbral(dx.value),
    (ahora, antes) => {
      if (ahora && antes === false) runOnJS(vibrarSuave)();
    }
  );

  const gesto = Gesture.Pan()
    .enabled(habilitado)
    .activeOffsetX(ARRANQUE_HORIZONTAL)
    .failOffsetY([-TOLERANCIA_VERTICAL, TOLERANCIA_VERTICAL])
    .onUpdate((evento) => {
      dx.value = desplazamientoVisible(evento.translationX);
    })
    .onEnd((evento) => {
      if (cruzoElUmbral(evento.translationX)) runOnJS(onResponder)();
    })
    .onFinalize(() => {
      dx.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const estiloBurbuja = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const estiloIcono = useAnimatedStyle(() => ({
    opacity: interpolate(dx.value, [0, UMBRAL_RESPUESTA], [0, 1]),
    transform: [{ scale: interpolate(dx.value, [0, UMBRAL_RESPUESTA], [0.6, 1]) }],
  }));

  return (
    <GestureDetector gesture={gesto}>
      <View>
        <Animated.View
          style={estiloIcono}
          className="absolute left-0 top-1/2 h-7 w-7 items-center justify-center rounded-full bg-primary/15"
        >
          <CornerUpLeft size={15} color={colores.primary} />
        </Animated.View>
        <Animated.View style={estiloBurbuja}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}
