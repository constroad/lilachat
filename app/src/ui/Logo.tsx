import { useId } from 'react';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';
import { LOGO } from '@lilachat/shared';
import { useTema } from './tema';

/**
 * Las dos burbujas de Lilachat (FL6), la MISMA geometría del ícono
 * (`shared/src/marca.ts`, `scripts/iconos-de-la-app.mts`). Va sola, sin
 * contenedor, a la izquierda del título —como el molinete en Lilafotos—; antes
 * era un ícono genérico de lucide dentro de un cuadrado violeta. En oscuro usa
 * los tonos de la variante oscura del ícono.
 */
export function Logo({ tamano = 28 }: { tamano?: number }) {
  const { oscuro } = useTema();
  const tonos = oscuro ? LOGO.tonos.oscuro : LOGO.tonos.claro;
  // Un id por instancia: dos logos en pantalla no comparten la máscara.
  const corte = `corte-${useId().replace(/:/g, '')}`;
  return (
    <Svg width={tamano} height={tamano} viewBox={`0 0 ${LOGO.viewBox} ${LOGO.viewBox}`} accessibilityLabel="Lilachat">
      <Defs>
        <Mask id={corte}>
          <Rect x={0} y={0} width={LOGO.viewBox} height={LOGO.viewBox} fill="#fff" />
          <Path d={LOGO.chica} fill="#000" stroke="#000" strokeWidth={LOGO.corte} strokeLinejoin="round" />
        </Mask>
      </Defs>
      <Path d={LOGO.grande} fill={tonos.grande} mask={`url(#${corte})`} />
      <Path d={LOGO.chica} fill={tonos.chica} />
    </Svg>
  );
}
