import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  DELIVERY_GLYPH,
  formatClock,
  groupsWithPrevious,
  resolveDeliveryState,
} from '@lilachat/shared';
import type { ChatMessage, PendingMessage } from './useChat';

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
}: {
  item: Row;
  previous?: Row;
  next?: Row;
  myUserId: string;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  senderInitial: string;
}) {
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
        <View className={`overflow-hidden rounded-lg ${tail} ${mine ? 'bg-primary' : 'bg-surface-variant'}`}>
          {!isPending(item) && item.media?.thumbUrl ? (
            <Image
              testID={`media-${item.seq}`}
              source={{ uri: item.media.thumbUrl }}
              style={{ width: 220, height: 220 }}
              contentFit="cover"
              transition={120}
            />
          ) : null}
          {item.body ? (
            <Text className={`px-3.5 py-2 text-base ${mine ? 'text-on-primary' : 'text-on-surface'}`}>
              {item.body}
            </Text>
          ) : null}
        </View>

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
