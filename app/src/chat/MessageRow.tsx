import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { porcentajeDeSubida } from './progresoDeSubida';
import { TEXTO_ELIMINADO, nombreDeContacto, textoDeAviso } from '@lilachat/shared';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import {
  DELIVERY_GLYPH,
  formatClock,
  groupsWithPrevious,
  resolveDeliveryState,
} from '@lilachat/shared';
import type { ChatMessage, PendingMessage } from './useChat';
import { useColores } from '../ui/tema';

/**
 * Una fila de la conversación, según el diseño «Chat Detail» de Stitch.
 *
 * Lo que la primera versión NO tenía y el diseño sí dibujaba —y que este
 * componente existe para arreglar—: la **hora bajo cada mensaje**, el **check
 * de entrega** en los propios (los acuses ya estaban en el server desde F2 y no
 * se veían), el **avatar del otro** junto a su burbuja, y el agrupado por
 * emisor (solo el último del bloque lleva la cola).
 */
export type Row = ChatMessage | PendingMessage;

export const isPending = (row: Row): row is PendingMessage =>
  'pending' in row && row.pending === true;

export function MessageRow({
  item,
  previous,
  next,
  myUserId,
  othersReadSeq,
  othersDeliveredSeq,
  senderInitial,
  onVerImagen,
  onSeleccionar,
  seleccionado,
}: {
  item: Row;
  previous?: Row;
  next?: Row;
  myUserId: string;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  senderInitial: string;
  /** Abre el visor a pantalla completa. */
  onVerImagen?: (url: string) => void;
  /** Pulsación larga: entra en modo selección. */
  onSeleccionar?: (seq: number) => void;
  seleccionado?: boolean;
}) {
  const colores = useColores();

  // Los avisos del grupo no son burbujas de nadie: van centrados, chiquitos y
  // sin cola. Se resuelve ANTES que todo lo demás porque nada de lo de abajo
  // —agrupado, checks, avatar— aplica.
  if (!isPending(item) && item.kind === 'system') {
    return <AvisoDelGrupo item={item} myUserId={myUserId} />;
  }

  const mine = isPending(item) || item.senderId === myUserId;
  const at = isPending(item) ? item.queuedAt : item.at;
  const senderId = isPending(item) ? myUserId : item.senderId;

  const grouped = groupsWithPrevious({
    senderId,
    at,
    previousSenderId: previous ? (isPending(previous) ? myUserId : previous.senderId) : undefined,
    previousAt: previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined,
  });
  // Solo el ÚLTIMO del bloque lleva la cola, como en el diseño.
  const nextGrouped = next
    ? groupsWithPrevious({
        senderId: isPending(next) ? myUserId : next.senderId,
        at: isPending(next) ? next.queuedAt : next.at,
        previousSenderId: senderId,
        previousAt: at,
      })
    : false;

  const delivery = resolveDeliveryState({
    seq: isPending(item) ? null : item.seq,
    otherReadSeq: othersReadSeq,
    otherDeliveredSeq: othersDeliveredSeq,
  });

  const tail = nextGrouped ? '' : mine ? 'rounded-br-tail' : 'rounded-bl-tail';

  return (
    <View className={`flex-row items-end gap-2 ${grouped ? 'mt-1' : 'mt-4'} ${mine ? 'justify-end' : ''}`}>
      {/* El avatar acompaña SOLO al último del bloque ajeno: repetirlo en cada
          burbuja del mismo emisor ensucia la columna. */}
      {!mine ? (
        <View className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          {!nextGrouped ? (
            <Text className="text-[11px] font-bold text-primary">{senderInitial}</Text>
          ) : null}
        </View>
      ) : null}

      <View className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'}`}>
        {/* La pulsación LARGA selecciona, como en WhatsApp. Un toque corto no
            hace nada acá: se reserva para abrir la foto. */}
        <Pressable
          onLongPress={() => !isPending(item) && onSeleccionar?.(item.seq)}
          delayLongPress={350}
          testID={!isPending(item) ? `burbuja-${item.seq}` : undefined}
          className={`overflow-hidden rounded-lg ${tail} ${mine ? 'bg-primary' : 'bg-surface-variant'} ${seleccionado ? 'opacity-60' : ''}`}
        >
          {!isPending(item) && item.media?.thumbUrl ? (
            <Pressable
              testID={`media-${item.seq}`}
              onPress={() => onVerImagen?.(item.media!.thumbUrl!)}
            >
              <Image
                source={{ uri: item.media.thumbUrl }}
                style={{ width: 220, height: 220 }}
                contentFit="cover"
                transition={120}
              />
            </Pressable>
          ) : null}

          {/* La foto que todavia sube: se ve YA, con un velo y su vueltita
              encima. El check aparece recien cuando el server la confirma, que
              es exactamente lo que hace WhatsApp. */}
          {isPending(item) && item.mediaUri ? (
            <View testID={`media-pendiente-${item.clientKey}`}>
              <Image
                source={{ uri: item.mediaUri }}
                style={{ width: 220, height: 220, opacity: 0.55 }}
                contentFit="cover"
              />
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator color={colores['on-primary']} />
                <Text className="mt-1 text-[11px] font-semibold text-on-primary">
                  {porcentajeDeSubida(item.progreso ?? 0)}%
                </Text>
              </View>
            </View>
          ) : null}
          {!isPending(item) && item.deletedAt ? (
            /**
             * La lápida. NO es un hueco: si el mensaje desapareciera sin rastro,
             * la conversación del otro cambiaría de sentido —respuestas colgando
             * de algo que ya no está— sin que se entere. En cursiva y apagado
             * para que se lea distinto de un mensaje de verdad.
             */
            <Text
              testID={`eliminado-${item.seq}`}
              className={`px-3.5 py-2 text-base italic ${mine ? 'text-on-primary/70' : 'text-on-surface-variant'}`}
            >
              {TEXTO_ELIMINADO}
            </Text>
          ) : item.body ? (
            <Text className={`px-3.5 py-2 text-base ${mine ? 'text-on-primary' : 'text-on-surface'}`}>
              {item.body}
            </Text>
          ) : null}
        </Pressable>

        {/* Hora + check, como en el diseño. El check azul de «leído» se
            distingue del gris de «entregado» por COLOR, no por forma. */}
        <View className="mt-0.5 flex-row items-center gap-1 px-1">
          <Text className="text-[11px] text-on-surface-variant" testID={`hora-${isPending(item) ? item.clientKey : item.seq}`}>
            {formatClock(at)}
          </Text>
          {mine ? (
            <Text
              testID={`estado-${isPending(item) ? item.clientKey : item.seq}`}
              className={`text-[11px] ${delivery === 'read' ? 'text-secondary' : 'text-on-surface-variant'}`}
            >
              {DELIVERY_GLYPH[delivery]}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** El chip centrado que separa los días («Hoy», «Ayer», «2 ago»). */
export function DaySeparator({ label }: { label: string }) {
  return (
    <View className="my-3 items-center">
      <View className="rounded-full bg-surface-variant px-3 py-1">
        <Text className="text-[11px] font-semibold text-on-surface-variant">{label}</Text>
      </View>
    </View>
  );
}

/**
 * «Wilson agregó a Ana», «Cambiaste la foto del grupo».
 *
 * El nombre sale de TU agenda, igual que en la lista de chats: el server solo
 * conoce el que cada uno se puso, y leer «960397018 agregó a…» fue exactamente
 * la queja que arregló `nombreDeContacto`. Si el aviso llegara sin los datos
 * para resolverlo, se cae al texto que armó el server (`body`) — y si tampoco
 * hay, no se dibuja nada: un renglón vacío en medio de la conversación es peor
 * que la ausencia del aviso.
 */
function AvisoDelGrupo({ item, myUserId }: { item: ChatMessage; myUserId: string }) {
  const agenda = agendaPorTelefono();
  const aviso = item.system;

  const nombreDe = (persona?: { phone?: string; name?: string }) =>
    persona
      ? nombreDeContacto({ delServidor: persona.name ?? null, telefono: persona.phone ?? null, agenda })
      : '';

  const texto = aviso
    ? textoDeAviso({
        quien: nombreDe(aviso.quien) || 'Alguien',
        esMio: item.senderId === myUserId,
        evento: aviso.evento,
        aQuien: nombreDe(aviso.aQuien) || undefined,
        valor: aviso.valor,
      }) || item.body || ''
    : (item.body ?? '');

  if (!texto) return null;

  return (
    <View className="items-center py-1.5" testID={`aviso-${item.seq}`}>
      <Text className="rounded-full bg-surface-variant/60 px-3 py-1 text-center text-[11px] text-on-surface-variant">
        {texto}
      </Text>
    </View>
  );
}
