import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useColores } from '../ui/tema';

const PASO = 22;
const OPACIDAD = 0.07;

/**
 * El fondo de la conversación (FL3, diseño «Conversación 1:1 · Claro»): un
 * patrón de puntos apenas visible sobre el tono del chat. Separa la
 * conversación de la lista —un chat sobre el mismo fondo liso que todo lo
 * demás se lee como una pantalla de formulario— sin competir con las burbujas.
 * Es UN `Svg` con un patrón: no hay imagen que cargar ni que decodificar.
 */
export const FondoDelChat = memo(function FondoDelChat() {
  const colores = useColores();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="puntos" width={PASO} height={PASO} patternUnits="userSpaceOnUse">
            <Circle cx={PASO / 2} cy={PASO / 2} r={1.2} fill={colores.primary} opacity={OPACIDAD} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={colores['fondo-chat']} />
        <Rect width="100%" height="100%" fill="url(#puntos)" />
      </Svg>
    </View>
  );
});
