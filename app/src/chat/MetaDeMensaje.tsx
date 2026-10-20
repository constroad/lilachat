import { Text, View } from 'react-native';
import { CircleAlert, Check, CheckCheck, Clock3, Star } from 'lucide-react-native';
import type { DeliveryState } from '@lilachat/shared';
import { useColores } from '../ui/tema';

const TAMANO_CHECK = 14;
export const ETIQUETA_EDITADO = 'Editado';

/**
 * Hora y estado DENTRO de la burbuja. Checks vectoriales, como WhatsApp: uno
 * gris (enviado), dos grises (entregado), dos azules (leído) y un relojito
 * mientras está en la cola. Antes eran glifos de texto y un emoji 🕐.
 */
export function MetaDeMensaje({
  hora,
  mia,
  entrega,
  id,
  sobreFoto = false,
  fallido = false,
  editado = false,
  destacado = false,
}: {
  hora: string;
  mia: boolean;
  entrega: DeliveryState;
  id: string;
  sobreFoto?: boolean;
  /** No se envió (rechazado para siempre): alerta en vez del reloj. */
  fallido?: boolean;
  /** Se editó: «Editado» antes de la hora, como WhatsApp. */
  editado?: boolean;
  /** Lo destaqué (20/10): la estrella chica antes de la hora, como WhatsApp. */
  destacado?: boolean;
}) {
  const colores = useColores();
  // Sobre la propia (violeta sólido, FL13) la hora y los íconos van claros.
  const tono = sobreFoto ? 'white' : mia ? colores['on-burbuja-propia-suave'] : colores['on-surface-variant'];
  const leido = mia ? colores['check-leido-propio'] : colores['check-leido'];
  return (
    <View className="flex-row items-center gap-1">
      {destacado ? <Star testID={`destacado-${id}`} size={TAMANO_CHECK - 3} color={tono} fill={tono} /> : null}
      <Text className="text-[11px]" style={{ color: tono }} testID={`hora-${id}`}>
        {editado ? `${ETIQUETA_EDITADO} ` : ''}
        {hora}
      </Text>
      {mia ? (
        <View testID={`estado-${id}`} accessibilityLabel={`estado ${entrega}`}>
          {fallido ? (
            <CircleAlert size={TAMANO_CHECK - 2} color={colores.error} />
          ) : entrega === 'pending' ? (
            <Clock3 size={TAMANO_CHECK - 2} color={tono} />
          ) : entrega === 'sent' ? (
            <Check size={TAMANO_CHECK} color={tono} />
          ) : (
            <CheckCheck size={TAMANO_CHECK} color={entrega === 'read' ? leido : tono} />
          )}
        </View>
      ) : null}
    </View>
  );
}
