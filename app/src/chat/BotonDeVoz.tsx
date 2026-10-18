import { useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Mic } from 'lucide-react-native';
import { decidirAlSoltar, mientrasSostiene, type DecisionDeVoz } from './gestoDeVoz';
import { useColores } from '../ui/tema';

type Sostener = ReturnType<typeof mientrasSostiene>;

/**
 * El micrófono de la barra (FL9): al apoyar el dedo empieza a grabar; al
 * soltar, `decidirAlSoltar` dice si se manda, se cancela o queda grabando sin
 * el dedo. Corre en el hilo de JS (`runOnJS(true)`): lo que se decide es poco
 * y solo avisa cuando cambia qué pasaría al soltar.
 *
 * Tiene que quedar MONTADO mientras se sostiene: si la barra lo reemplaza, el
 * gesto se corta a la mitad.
 */
export function BotonDeVoz(props: {
  deshabilitado: boolean;
  onEmpezar: () => void;
  onMover: (estado: Sostener) => void;
  onSoltar: (decision: DecisionDeVoz) => void;
}) {
  const colores = useColores();
  const inicio = useRef(0);
  const ultimo = useRef({ dx: 0, dy: 0 });
  const estado = useRef<Sostener>('normal');

  const gesto = Gesture.Pan()
    .runOnJS(true)
    .enabled(!props.deshabilitado)
    .minDistance(0)
    .onBegin(() => {
      inicio.current = Date.now();
      ultimo.current = { dx: 0, dy: 0 };
      estado.current = 'normal';
      props.onEmpezar();
    })
    .onUpdate((evento) => {
      ultimo.current = { dx: evento.translationX, dy: evento.translationY };
      const ahora = mientrasSostiene(ultimo.current);
      if (ahora === estado.current) return;
      estado.current = ahora;
      props.onMover(ahora);
    })
    .onFinalize(() => {
      props.onSoltar(decidirAlSoltar({ ...ultimo.current, ms: Date.now() - inicio.current }));
    });

  return (
    <GestureDetector gesture={gesto}>
      <View
        testID="btn-voz"
        accessibilityRole="button"
        accessibilityLabel="Grabar una nota de voz: mantén presionado, o toca para grabar sin el dedo"
        className={`h-11 w-11 items-center justify-center rounded-full bg-primary ${props.deshabilitado ? 'opacity-40' : ''}`}
      >
        <Mic size={18} color={colores['on-primary']} />
      </View>
    </GestureDetector>
  );
}
