import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { disposicion, type Disposicion } from './disposicion';

/** La disposición de la pantalla, al día con cada giro (FL10). */
export function useDisposicion(): Disposicion {
  const { width, height } = useWindowDimensions();
  return useMemo(() => disposicion({ ancho: width, alto: height }), [width, height]);
}
