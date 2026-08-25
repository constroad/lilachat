import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { margenInferior, margenSuperior } from './margenes';

/**
 * El aire de arriba y de abajo YA resuelto, listo para un `style`.
 *
 * Toda pantalla con algo anclado al pie usa `pie`; toda cabecera usa `cabecera`.
 * Nada de `pb-8` ni `pt-14` a mano: esos números fijos son los que dejaron el
 * botón «Continuar» debajo de la barra de tres botones de Android.
 *
 * Se devuelve como número y no como clase de Tailwind porque el valor depende
 * del teléfono y NativeWind no puede generar una clase por cada inset posible.
 */
export function useMargenes(): { pie: number; cabecera: number } {
  const insets = useSafeAreaInsets();
  return {
    pie: margenInferior(insets.bottom),
    cabecera: margenSuperior(insets.top),
  };
}
