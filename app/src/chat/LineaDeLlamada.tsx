import { Pressable, Text, View } from 'react-native';
import { AlarmClock, Phone, PhoneMissed, Video } from 'lucide-react-native';
import { formatClock, leerValorDeLlamada, textoDeLlamada } from '@lilachat/shared';
import { useAccionesDeTarjeta } from './accionesDeTarjeta';
import type { ChatMessage } from './useChat';
import { useColores } from '../ui/tema';

/**
 * La línea que deja una llamada en el chat (FL8.1), como en WhatsApp: ícono,
 * «Llamada perdida» / «Llamada sin respuesta» / «Llamada de voz · 02:13» y la
 * hora. La perdida (para quien no contestó) va en rojo: es la que hay que ver,
 * con «Llamar» y «Recordarme» debajo (backlog 23, José 21/10).
 */
export function LineaDeLlamada({ item, myUserId }: { item: ChatMessage; myUserId: string }) {
  const colores = useColores();
  const { callBack } = useAccionesDeTarjeta();
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
      {perdida && callBack ? (
        <View className="mt-1.5 flex-row gap-2">
          <Pressable testID={`llamar-de-nuevo-${item.seq}`} onPress={() => callBack.call(registro.video)} className="h-9 flex-row items-center gap-1.5 rounded-full border border-outline/20 bg-surface px-3.5">
            <Phone size={14} color={colores.primary} />
            <Text className="text-[13px] font-semibold text-primary">Llamar</Text>
          </Pressable>
          <Pressable testID={`recordar-devolver-${item.seq}`} onPress={() => callBack.remind(registro.video)} className="h-9 flex-row items-center gap-1.5 rounded-full border border-outline/20 bg-surface px-3.5">
            <AlarmClock size={14} color={colores.primary} />
            <Text className="text-[13px] font-semibold text-primary">Recordarme</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
