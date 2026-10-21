import type { ReactNode } from 'react';
import { Alert, Pressable, Text, ToastAndroid, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { formatClock, type DeliveryState } from '@lilachat/shared';
import type { ChatMessage } from '../useChat';
import { Avatar } from '../../ui/Avatar';
import { AVATAR_DE_AUTOR } from '../burbuja';
import { DeslizarParaResponder } from '../DeslizarParaResponder';
import { MetaDeMensaje } from '../MetaDeMensaje';
import { keepReceivedSticker } from './useStickers';

/** Side of a sticker in the chat (dp), like WhatsApp. */
const SIDE = 160;

/**
 * A sticker in the chat (José, 20/10; design `s1-app-panel-stickers`): no
 * bubble, the time in a small pill UNDER it, like WhatsApp (José, 21/10: on top
 * it covered the sticker). Swipe to reply and long-press to select
 * (reactions, thread) like any message; a tap offers to keep it in «Mis
 * stickers» or as a favorite.
 */
/** How much wider than the sticker its quote may be. */
const QUOTE_EXTRA_WIDTH = 60;

export function StickerMessage(props: {
  item: ChatMessage;
  mine: boolean;
  jwt: string;
  delivery: DeliveryState;
  starred: boolean;
  author?: { name: string; photo?: string };
  onSelect?: (seq: number) => void;
  selecting: boolean;
  selected: boolean;
  onReply?: (seq: number, previewText: string, mine: boolean) => void;
  /** A sticker sent as a reply shows what it answers above it, as WhatsApp does (20/10). */
  quote?: ReactNode;
}) {
  const { item, mine } = props;
  const keep = async (asFavorite: boolean) => ToastAndroid.show(await keepReceivedSticker(props.jwt, item.chatId, item.seq, asFavorite), ToastAndroid.SHORT);
  const showOptions = () =>
    Alert.alert('Sticker', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Agregar a favoritos', onPress: () => void keep(true) },
      ...(mine ? [] : [{ text: 'Guardar en Mis stickers', onPress: () => void keep(false) }]),
    ]);
  return (
    <DeslizarParaResponder habilitado={!props.selecting && Boolean(props.onReply)} onResponder={() => props.onReply?.(item.seq, 'Sticker', mine)}>
      <View testID={`sticker-${item.seq}`} className={`-mx-3 flex-row items-end gap-2 px-3 pt-3 ${mine ? 'justify-end' : ''} ${props.selected ? 'bg-primary/15' : ''}`}>
        {props.author ? <Avatar nombre={props.author.name} foto={props.author.photo} tamano={AVATAR_DE_AUTOR} /> : null}
        <View>
          {props.author?.name ? <Text className="mb-0.5 px-1 text-[13px] font-semibold text-on-surface-variant" numberOfLines={1}>{props.author.name}</Text> : null}
          {props.quote ? <View className="mb-1 rounded-xl border border-outline/15 bg-surface px-2 pb-1 pt-2" style={{ maxWidth: SIDE + QUOTE_EXTRA_WIDTH }}>{props.quote}</View> : null}
          <Pressable
            onPress={() => (props.selecting ? props.onSelect?.(item.seq) : showOptions())}
            onLongPress={() => {
              void Haptics.selectionAsync();
              props.onSelect?.(item.seq);
            }}
            delayLongPress={350}
          >
            <Image source={{ uri: item.media?.url }} style={{ width: SIDE, height: SIDE }} contentFit="contain" recyclingKey={item.clientKey} transition={120} />
          </Pressable>
          <View className={`mt-0.5 rounded-full bg-black/35 px-1.5 py-0.5 ${mine ? 'self-end' : 'self-start'}`}>
            <MetaDeMensaje hora={formatClock(item.at)} mia={mine} entrega={props.delivery} id={String(item.seq)} sobreFoto destacado={props.starred} />
          </View>
        </View>
      </View>
    </DeslizarParaResponder>
  );
}
