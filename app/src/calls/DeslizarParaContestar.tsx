import { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChevronUp, Phone } from 'lucide-react-native';
import { useColores } from '../ui/tema';
import { decidirDeslizamiento, UMBRAL_DE_DESLIZAR } from './llamadaNativa';

/** Lo que sube el botón como máximo: un poco más que el umbral (dp). */
const RECORRIDO_MAXIMO = UMBRAL_DE_DESLIZAR + 30;
/** El saltito que invita a deslizar, como el de WhatsApp (dp). */
const SALTITO = 10;

/**
 * Deslizar hacia arriba para contestar, como WhatsApp (FL8.1, pedido de José).
 *
 * Un toque NO contesta: con el teléfono en el bolsillo o en la mano se
 * contestaría sin querer. El botón salta solo para que se entienda que se
 * arrastra; soltarlo antes del umbral lo devuelve a su lugar. Para TalkBack
 * la acción «Contestar» está declarada: deslizar no es accesible.
 */
export function DeslizarParaContestar({ onContestar }: { onContestar: () => void }) {
  const colores = useColores();
  const arrastre = useSharedValue(0);
  const salto = useSharedValue(0);
  // Se cruza a JS SIN argumentos: pasar una función de JS como argumento de
  // `runOnJS` desde el worklet no llega (el gesto no contestaba en el E2E).
  const contestar = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onContestar();
  }, [onContestar]);

  useEffect(() => {
    salto.value = withRepeat(
      withSequence(
        withTiming(-SALTITO, { duration: 450, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 700 })
      ),
      -1
    );
  }, [salto]);

  const gesto = Gesture.Pan()
    .onUpdate((evento) => {
      arrastre.value = Math.max(-RECORRIDO_MAXIMO, Math.min(0, evento.translationY));
    })
    .onEnd((evento) => {
      if (decidirDeslizamiento({ dy: evento.translationY, vy: evento.velocityY }) === 'contestar') {
        runOnJS(contestar)();
      } else {
        arrastre.value = withSpring(0);
      }
    });

  const estiloBoton = useAnimatedStyle(() => ({
    transform: [{ translateY: arrastre.value === 0 ? salto.value : arrastre.value }],
  }));

  return (
    <View className="items-center">
      <ChevronUp size={22} color={colores['on-primary']} style={{ opacity: 0.7 }} />
      <GestureDetector gesture={gesto}>
        <Animated.View
          testID="btn-contestar"
          accessibilityRole="button"
          accessibilityLabel="Contestar"
          accessibilityHint="Desliza hacia arriba para contestar"
          accessibilityActions={[{ name: 'activate', label: 'Contestar' }]}
          onAccessibilityAction={(evento) => {
            if (evento.nativeEvent.actionName === 'activate') onContestar();
          }}
          className="mt-1 h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-500"
          style={estiloBoton}
        >
          <Phone size={30} color={colores['on-primary']} />
        </Animated.View>
      </GestureDetector>
      <Text className="mt-2 text-[13px] text-on-primary/80">Desliza para contestar</Text>
    </View>
  );
}
