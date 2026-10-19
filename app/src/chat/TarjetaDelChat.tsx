import { Text, View } from 'react-native';
import { formatClock } from '@lilachat/shared';
import type { ChatMessage } from './useChat';
import { EncuestaEnElChat } from './EncuestaEnElChat';
import { EventoEnElChat } from './EventoEnElChat';
import { RecordatorioEnElChat } from './RecordatorioEnElChat';
import { AVATAR_DE_AUTOR, colorDeAutor } from './burbuja';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';

/** El ancho de la tarjeta de encuesta o evento en el chat (dp). */
const ANCHO_DE_TARJETA = 320;
/** El `gap-2` entre el avatar y la tarjeta (dp): la hora arranca donde la tarjeta. */
const SEPARACION_DEL_AVATAR = 8;

/**
 * La fila de una encuesta o un evento publicados en el chat (José, 18/10): la
 * tarjeta alineada como un mensaje de quien la creó, con la hora abajo.
 *
 * En un grupo va como cualquier mensaje ajeno (FL13d): el avatar a la
 * izquierda y el nombre en el color de esa persona. Antes la tarjeta quedaba
 * fuera de la columna de las burbujas y el autor salía dos veces.
 */
export function TarjetaDelChat(props: {
  item: ChatMessage;
  mia: boolean;
  jwt: string;
  yo: string;
  /** Solo en grupos: quién la publicó. */
  autor?: { nombre: string; foto?: string };
}) {
  const { item, mia } = props;
  const colores = useColores();
  const autor = mia ? undefined : props.autor;
  const colorAutor = colores[`autor-${colorDeAutor(String(item.senderId))}` as keyof typeof colores] as string;
  return (
    <View className={`pt-3 ${mia ? 'items-end' : 'items-start'}`} testID={`tarjeta-${item.ref!.tipo}-${item.seq}`}>
      {/* El avatar va al pie de la TARJETA, como en las burbujas; la hora, debajo de la fila. */}
      <View className={`-mx-3 flex-row items-end gap-2 px-3 ${mia ? 'justify-end' : ''}`}>
        {autor ? <Avatar nombre={autor.nombre} foto={autor.foto} tamano={AVATAR_DE_AUTOR} /> : null}
        <View className={`max-w-[88%] ${mia ? 'items-end' : 'items-start'}`} style={{ width: ANCHO_DE_TARJETA }}>
          {autor?.nombre ? (
            <Text className="mb-1 px-1 text-[13px] font-semibold" style={{ color: colorAutor }} numberOfLines={1}>
              {autor.nombre}
            </Text>
          ) : null}
          <View className="w-full">
            {item.ref!.tipo === 'encuesta' ? (
              <EncuestaEnElChat pollId={item.ref!.id} jwt={props.jwt} yo={props.yo} />
            ) : item.ref!.tipo === 'recordatorio' ? (
              <RecordatorioEnElChat reminderId={item.ref!.id} jwt={props.jwt} />
            ) : (
              <EventoEnElChat eventId={item.ref!.id} jwt={props.jwt} />
            )}
          </View>
        </View>
      </View>
      <Text className="mt-1 px-1 text-[11px] text-on-surface-variant" style={autor ? { marginLeft: AVATAR_DE_AUTOR + SEPARACION_DEL_AVATAR } : undefined}>
        {formatClock(item.at)}
      </Text>
    </View>
  );
}
