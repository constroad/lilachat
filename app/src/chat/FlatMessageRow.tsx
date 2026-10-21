import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { CircleAlert } from 'lucide-react-native';
import { TEXTO_ELIMINADO, formatClock, groupsWithPrevious, primerEnlace, type DeliveryState } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { useChatFont } from '../ui/chatFont';
import { DeslizarParaResponder } from './DeslizarParaResponder';
import { CitaDeRespuesta } from './CitaDeRespuesta';
import { MetaDeMensaje } from './MetaDeMensaje';
import { MessageMedia } from './MessageMedia';
import { TextoDelMensaje } from './TextoDelMensaje';
import { VistaPreviaDeEnlace } from './VistaPreviaDeEnlace';
import { previewDeMensaje, quoteAction } from './MessageRow';
import { isPending, type Row } from './rowKinds';
import type { Citado } from './filasDelChat';
import { CardBody } from './TarjetaDelChat';
import { showStickerOptions, useAnimatedStop } from './stickers/StickerMessage';

/** The avatar of a flat row and the gap to its text (design `s-01`): the reactions and the thread chip line up after them. */
export const FLAT_AVATAR = 40;
export const FLAT_GAP = 12;
export const FLAT_INDENT = FLAT_AVATAR + FLAT_GAP;
/** A card keeps its width; a sticker is a bit smaller than in a 1:1. */
const FLAT_CARD = 320;
const FLAT_STICKER = 120;

const atOf = (row: Row) => (isPending(row) ? row.queuedAt : row.at);

/**
 * A message as a flat row, like Slack (José, 21/10: «Lilachat se ve muy
 * desordenado»; design `s-01-grupo-formato-slack`): the avatar on the left,
 * then the name, its role and the time, and the text below without a bubble.
 * Mine go on the left too, with my name in the accent. Messages in a row from
 * the same person within 5 minutes go under it without repeating the header.
 * Same gestures as the bubble: swipe to reply, long press to select.
 */
function FlatRow(props: {
  item: Row;
  previous?: Row;
  myUserId: string;
  jwt?: string;
  linkPreview: boolean;
  names?: ReadonlyMap<string, string>;
  /** Everyone's name, also for a checklist (who ticked, who is in charge). */
  everyName?: ReadonlyMap<string, string>;
  delivery?: DeliveryState;
  authorName?: string;
  authorPhoto?: string;
  /** «Residente de obra», «Admin», «Tú»… (`memberBadge`). */
  badge: string | null;
  quoted?: Citado | null;
  selected?: boolean;
  selecting?: boolean;
  starred?: boolean;
  onOpenMedia?: (seq: number) => void;
  onSelect?: (seq: number) => void;
  onReply?: (seq: number, previewText: string, mine: boolean) => void;
  onFailed?: (clientKey: string, reason: string) => void;
  /** A quote goes to the quoted message; a thread reply sent to the chat opens its thread. */
  onGoToQuote?: (seq: number) => void;
  onOpenThread?: (seq: number) => void;
}) {
  const colors = useColores();
  const font = useChatFont();
  const { item, previous } = props;
  const mine = isPending(item) || item.senderId === props.myUserId;
  const senderId = isPending(item) ? props.myUserId : item.senderId;
  const grouped = Boolean(previous) && groupsWithPrevious({ senderId, at: atOf(item), previousSenderId: previous && (isPending(previous) ? props.myUserId : previous.senderId), previousAt: previous && atOf(previous) });
  const id = isPending(item) ? item.clientKey : String(item.seq);
  const failed = isPending(item) ? item.fallo : undefined;
  const deleted = !isPending(item) && Boolean(item.deletedAt);
  const name = mine ? (props.authorName ?? 'Tú') : (props.authorName ?? 'Alguien');
  const meta = { hora: formatClock(atOf(item)), mia: mine, entrega: props.delivery ?? (isPending(item) ? ('pending' as const) : ('sent' as const)), id, fallido: Boolean(failed), editado: !isPending(item) && Boolean(item.editedAt) && !deleted, destacado: Boolean(props.starred), flat: true };
  const card = !isPending(item) && item.ref && props.jwt ? item : null;
  const sticker = !isPending(item) && item.kind === 'sticker' && item.media?.url && !deleted && props.jwt ? item : null;
  const animated = useAnimatedStop(sticker?.media?.url);
  const press = isPending(item) ? (failed ? () => props.onFailed?.(item.clientKey, failed) : undefined) : props.selecting ? () => props.onSelect?.(item.seq) : undefined;

  return (
    <DeslizarParaResponder habilitado={!isPending(item) && !props.selecting} onResponder={() => !isPending(item) && props.onReply?.(item.seq, previewDeMensaje(item), mine)}>
      <Pressable
        testID={!isPending(item) ? `fila-${item.seq}` : undefined}
        onPress={press}
        onLongPress={() => {
          if (isPending(item)) return;
          void Haptics.selectionAsync();
          props.onSelect?.(item.seq);
        }}
        delayLongPress={350}
        className={`-mx-3 flex-row px-3 ${grouped ? 'pt-0.5' : 'pt-3'} ${props.selected ? 'bg-primary/15' : ''}`}
        style={{ gap: FLAT_GAP }}
      >
        {grouped ? <View style={{ width: FLAT_AVATAR }} /> : <Avatar nombre={name} foto={props.authorPhoto} tamano={FLAT_AVATAR} />}
        <View className="min-w-0 flex-1">
          {grouped ? null : (
            <View className="mb-0.5 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
              <Text testID={`autor-${id}`} numberOfLines={1} className={`shrink text-[15px] font-bold ${mine ? 'text-primary' : 'text-on-surface'}`}>{name}</Text>
              {props.badge && props.badge !== name ? (
                <View className={`rounded-md px-1.5 py-0.5 ${mine ? 'bg-primary/10' : 'bg-surface-variant'}`}>
                  <Text className={`text-[11px] font-semibold ${mine ? 'text-primary' : 'text-on-surface-variant'}`}>{props.badge}</Text>
                </View>
              ) : null}
              <MetaDeMensaje {...meta} />
            </View>
          )}
          {props.quoted ? <CitaDeRespuesta citado={props.quoted} enBurbujaPropia={false} testID={`cita-${id}`} onPress={isPending(item) ? undefined : props.selecting ? () => props.onSelect?.(item.seq) : quoteAction(props.quoted, item.replyToSeq, props.onOpenThread, props.onGoToQuote)} /> : null}
          {card ? (
            <View style={{ maxWidth: FLAT_CARD }}>
              <CardBody item={card} jwt={props.jwt!} yo={props.myUserId} everyName={props.everyName} selecting={props.selecting} onSelect={props.onSelect} />
            </View>
          ) : sticker ? (
            <Pressable testID={`sticker-${sticker.seq}`} onPress={() => (props.selecting ? props.onSelect?.(sticker.seq) : animated.stopped ? animated.replay() : showStickerOptions(props.jwt!, sticker, mine))} className="self-start">
              <Image ref={animated.ref} source={{ uri: sticker.media!.url }} style={{ width: FLAT_STICKER, height: FLAT_STICKER }} contentFit="contain" recyclingKey={sticker.clientKey} />
            </Pressable>
          ) : (
            <MessageMedia item={item} mine={false} flat selecting={props.selecting} onSelect={props.onSelect} onOpen={props.onOpenMedia} />
          )}
          {card || sticker ? null : deleted ? (
            <Text testID={`eliminado-${id}`} className="text-[15px] italic text-on-surface-variant">{TEXTO_ELIMINADO}</Text>
          ) : item.body ? (
            <>
              {props.linkPreview && props.jwt && !isPending(item) && !item.media && primerEnlace(item.body) ? <VistaPreviaDeEnlace url={primerEnlace(item.body)!} jwt={props.jwt} mia={false} /> : null}
              <Text className="text-on-surface" style={{ fontSize: font.size, lineHeight: font.line }}>
                <TextoDelMensaje texto={item.body} menciones={isPending(item) ? undefined : item.menciones} nombres={props.names} yo={props.myUserId} enBurbujaPropia={false} id={isPending(item) ? item.clientKey : `${item.chatId}:${item.seq}`} />
              </Text>
            </>
          ) : null}
          {/* Under a header the time is up there; a grouped one only shows what changed (edited, still going, failed). */}
          {grouped && (meta.editado || meta.entrega === 'pending' || meta.destacado) ? (
            <View className="mt-0.5 flex-row">
              <MetaDeMensaje {...meta} />
            </View>
          ) : null}
          {failed ? (
            <View testID={`fallo-${id}`} className="mt-1 min-h-[28px] flex-row items-center gap-1">
              <CircleAlert size={13} color={colors.error} />
              <Text className="text-[11px] text-error">No se envió · Toca para reintentar</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </DeslizarParaResponder>
  );
}

export const FlatMessageRow = memo(FlatRow);
