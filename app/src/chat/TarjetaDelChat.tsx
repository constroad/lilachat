import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatClock } from '@lilachat/shared';
import type { ChatMessage } from './useChat';
import { EncuestaEnElChat } from './EncuestaEnElChat';
import { EventoEnElChat } from './EventoEnElChat';
import { RecordatorioEnElChat } from './RecordatorioEnElChat';
import { ChecklistEnElChat } from './ChecklistEnElChat';
import { AVATAR_DE_AUTOR, colorDeAutor } from './burbuja';
import { DeslizarParaResponder } from './DeslizarParaResponder';
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
 *
 * Y se trata como un mensaje (José, 20/10: «a un recordatorio no puedo
 * deslizar para responder, reaccionar ni crear hilos»): deslizar la responde,
 * mantenerla la elige (reacciones, responder en hilo, fijar…) y, con
 * mensajes elegidos, un toque la suma o la saca en vez de votar o editar.
 */
export function TarjetaDelChat(props: {
  item: ChatMessage;
  mia: boolean;
  jwt: string;
  yo: string;
  /** Solo en grupos: quién la publicó. */
  autor?: { nombre: string; foto?: string };
  /** Everyone's name: who ticked each task of a checklist. */
  everyName?: ReadonlyMap<string, string>;
  onSeleccionar?: (seq: number) => void;
  enSeleccion?: boolean;
  seleccionado?: boolean;
  onResponder?: (seq: number, textoPreview: string, mio: boolean) => void;
}) {
  const { item, mia } = props;
  const colores = useColores();
  const autor = mia ? undefined : props.autor;
  const colorAutor = colores[`autor-${colorDeAutor(String(item.senderId))}` as keyof typeof colores] as string;
  const elegir = () => {
    void Haptics.selectionAsync();
    props.onSeleccionar?.(item.seq);
  };
  return (
    <DeslizarParaResponder habilitado={!props.enSeleccion && Boolean(props.onResponder)} onResponder={() => props.onResponder?.(item.seq, item.body ?? 'Tarjeta', mia)}>
    <View className={`-mx-3 px-3 pt-3 ${mia ? 'items-end' : 'items-start'} ${props.seleccionado ? 'bg-primary/15' : ''}`} testID={`tarjeta-${item.ref!.tipo}-${item.seq}`}>
      {/* El avatar va al pie de la TARJETA, como en las burbujas; la hora, debajo de la fila. */}
      <View className={`flex-row items-end gap-2 ${mia ? 'justify-end' : ''}`}>
        {autor ? <Avatar nombre={autor.nombre} foto={autor.foto} tamano={AVATAR_DE_AUTOR} /> : null}
        <View className={`max-w-[88%] ${mia ? 'items-end' : 'items-start'}`} style={{ width: ANCHO_DE_TARJETA }}>
          {autor?.nombre ? (
            <Text className="mb-1 px-1 text-[13px] font-semibold" style={{ color: colorAutor }} numberOfLines={1}>
              {autor.nombre}
            </Text>
          ) : null}
          <Pressable testID={`mantener-tarjeta-${item.seq}`} onLongPress={elegir} delayLongPress={350} className="w-full">
            {item.ref!.tipo === 'encuesta' ? (
              <EncuestaEnElChat pollId={item.ref!.id} jwt={props.jwt} yo={props.yo} />
            ) : item.ref!.tipo === 'checklist' ? (
              <ChecklistEnElChat checklistId={item.ref!.id} jwt={props.jwt} yo={props.yo} nameOf={(userId) => props.everyName?.get(userId) ?? 'Alguien'} />
            ) : item.ref!.tipo === 'recordatorio' ? (
              <RecordatorioEnElChat reminderId={item.ref!.id} jwt={props.jwt} onLongPress={elegir} />
            ) : (
              <EventoEnElChat eventId={item.ref!.id} jwt={props.jwt} />
            )}
            {/* Con mensajes elegidos, el toque elige: no vota, no confirma, no edita. */}
            {props.enSeleccion ? <Pressable testID={`elegir-tarjeta-${item.seq}`} onPress={() => props.onSeleccionar?.(item.seq)} className="absolute inset-0" /> : null}
          </Pressable>
        </View>
      </View>
      {/* Con reacciones, aire bajo la hora: la pastilla sube sobre lo de arriba y la tapaba. */}
      <Text className={`mt-1 px-1 text-[11px] text-on-surface-variant ${item.reacciones?.length ? 'mb-3' : ''}`} style={autor ? { marginLeft: AVATAR_DE_AUTOR + SEPARACION_DEL_AVATAR } : undefined}>
        {formatClock(item.at)}
      </Text>
    </View>
    </DeslizarParaResponder>
  );
}
