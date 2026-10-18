import { Switch } from 'react-native';
import { useColores } from './tema';

/** El riel apagado: el contorno al 40 % (sufijo de alfa sobre el hex del token). */
const ALFA_DEL_RIEL_APAGADO = '66';

/**
 * El interruptor de toda la app (FL13, auditoría §48). Con los colores de
 * Android, apagado era un riel blanco sobre una tarjeta blanca: en modo claro
 * se veía solo la bolita gris. Como Material 3: apagado, riel gris y bolita
 * oscura; prendido, riel de la marca y bolita clara.
 */
export function Interruptor(props: {
  value: boolean;
  onValueChange: (valor: boolean) => void;
  testID?: string;
  disabled?: boolean;
}) {
  const colores = useColores();
  return (
    <Switch
      testID={props.testID}
      value={props.value}
      onValueChange={props.onValueChange}
      disabled={props.disabled}
      trackColor={{ false: `${colores.outline}${ALFA_DEL_RIEL_APAGADO}`, true: colores.primary }}
      thumbColor={props.value ? colores['on-primary'] : colores['on-surface-variant']}
      ios_backgroundColor={`${colores.outline}${ALFA_DEL_RIEL_APAGADO}`}
    />
  );
}
