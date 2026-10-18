import { Text } from 'react-native';

/**
 * El rótulo de una sección («AVISOS», «PARTICIPANTES»): mayúsculas chicas
 * sobre el bloque. Estaba copiado igual en Ajustes, el detalle del chat y la
 * configuración del chat. `sangrado` es para las pantallas cuyo contenido no
 * trae su propio margen lateral.
 */
export function Rotulo({ children, sangrado = false }: { children: string; sangrado?: boolean }) {
  return (
    <Text
      className={`mb-2 mt-6 ${sangrado ? 'px-4' : ''} text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant`}
    >
      {children}
    </Text>
  );
}
