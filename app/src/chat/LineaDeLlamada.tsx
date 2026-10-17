import { Text, View } from 'react-native';
import { Phone, PhoneMissed, Video } from 'lucide-react-native';
import { formatClock, leerValorDeLlamada, textoDeLlamada } from '@lilachat/shared';
import type { ChatMessage } from './useChat';
import { useColores } from '../ui/tema';

/**
 * La línea que deja una llamada en el chat (FL8.1), como en WhatsApp: ícono,
 * «Llamada perdida» / «Llamada sin respuesta» / «Llamada de voz · 02:13» y la
 * hora. La perdida (para quien no contestó) va en rojo: es la que hay que ver.
 */
export function LineaDeLlamada({ item, myUserId }: { item: ChatMessage; myUserId: string }) {
  const colores = useColores();
  const valor = item.system?.valor;
  const registro = leerValorDeLlamada(valor);
  const esMio = item.senderId === myUserId;
  const texto = textoDeLlamada({ valor, esMio });
  if (!registro || !texto) return null;

  const perdida = registro.segundos === null && !esMio;
  const Icono = perdida ? PhoneMissed : registro.video ? Video : Phone;
  return (
    <View className="items-center py-1.5" testID={`llamada-${item.seq}`}>
      <View className="flex-row items-center gap-1.5 rounded-full bg-surface-variant/60 px-3 py-1">
        <Icono size={13} color={perdida ? colores.error : colores['on-surface-variant']} />
        <Text className={`text-[12px] ${perdida ? 'text-error' : 'text-on-surface-variant'}`}>
          {texto} · {formatClock(item.at)}
        </Text>
      </View>
    </View>
  );
}
