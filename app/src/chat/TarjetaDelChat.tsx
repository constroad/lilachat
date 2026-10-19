import { Text, View } from 'react-native';
import { formatClock } from '@lilachat/shared';
import type { ChatMessage } from './useChat';
import { EncuestaEnElChat } from './EncuestaEnElChat';
import { EventoEnElChat } from './EventoEnElChat';

/** El ancho de la tarjeta de encuesta o evento en el chat (dp). */
const ANCHO_DE_TARJETA = 320;

/**
 * La fila de una encuesta o un evento publicados en el chat (José, 18/10): la
 * tarjeta alineada como un mensaje de quien la creó, con la hora abajo.
 */
export function TarjetaDelChat(props: { item: ChatMessage; mia: boolean; jwt: string; yo: string; autor?: string }) {
  const { item, mia } = props;
  return (
    <View className={`my-1.5 ${mia ? 'items-end' : 'items-start'}`} testID={`tarjeta-${item.ref!.tipo}-${item.seq}`}>
      {props.autor && !mia ? <Text className="mb-1 px-1 text-[12px] font-semibold text-on-surface-variant">{props.autor}</Text> : null}
      <View style={{ width: ANCHO_DE_TARJETA, maxWidth: '88%' }}>
        {item.ref!.tipo === 'encuesta' ? (
          <EncuestaEnElChat pollId={item.ref!.id} jwt={props.jwt} yo={props.yo} />
        ) : (
          <EventoEnElChat eventId={item.ref!.id} jwt={props.jwt} />
        )}
      </View>
      <Text className="mt-1 px-1 text-[11px] text-on-surface-variant">{formatClock(item.at)}</Text>
    </View>
  );
}
