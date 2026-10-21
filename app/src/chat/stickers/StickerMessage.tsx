import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, ToastAndroid, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ANIMATED_STICKER_PLAY_MS, formatClock, isAnimatedSticker, type DeliveryState } from '@lilachat/shared';
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
  const animated = useAnimatedStop(item.media?.url);
  const showOptions = () => showStickerOptions(props.jwt, item, mine);
  return (
    <DeslizarParaResponder habilitado={!props.selecting && Boolean(props.onReply)} onResponder={() => props.onReply?.(item.seq, 'Sticker', mine)}>
      <View testID={`sticker-${item.seq}`} className={`-mx-3 flex-row items-end gap-2 px-3 pt-3 ${mine ? 'justify-end' : ''} ${props.selected ? 'bg-primary/15' : ''}`}>
        {props.author ? <Avatar nombre={props.author.name} foto={props.author.photo} tamano={AVATAR_DE_AUTOR} /> : null}
        <View>
          {props.author?.name ? <Text className="mb-0.5 px-1 text-[13px] font-semibold text-on-surface-variant" numberOfLines={1}>{props.author.name}</Text> : null}
          {props.quote ? <View className="mb-1 rounded-xl border border-outline/15 bg-surface px-2 pb-1 pt-2" style={{ maxWidth: SIDE + QUOTE_EXTRA_WIDTH }}>{props.quote}</View> : null}
          <Pressable
            onPress={() => (props.selecting ? props.onSelect?.(item.seq) : animated.stopped ? animated.replay() : showOptions())}
            onLongPress={() => {
              void Haptics.selectionAsync();
              props.onSelect?.(item.seq);
            }}
            delayLongPress={350}
          >
            <Image ref={animated.ref} source={{ uri: item.media?.url }} style={{ width: SIDE, height: SIDE }} contentFit="contain" recyclingKey={item.clientKey} transition={120} />
          </Pressable>
          <View className={`mt-0.5 rounded-full bg-black/35 px-1.5 py-0.5 ${mine ? 'self-end' : 'self-start'}`}>
            <MetaDeMensaje hora={formatClock(item.at)} mia={mine} entrega={props.delivery} id={String(item.seq)} sobreFoto destacado={props.starred} />
          </View>
        </View>
      </View>
    </DeslizarParaResponder>
  );
}

/** A tap on a sticker in the chat: keep it as a favorite, or someone else's in «Mis stickers». */
export function showStickerOptions(jwt: string, item: ChatMessage, mine: boolean): void {
  const keep = async (asFavorite: boolean) => ToastAndroid.show(await keepReceivedSticker(jwt, item.chatId, item.seq, asFavorite), ToastAndroid.SHORT);
  Alert.alert('Sticker', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Agregar a favoritos', onPress: () => void keep(true) },
    ...(mine ? [] : [{ text: 'Guardar en Mis stickers', onPress: () => void keep(false) }]),
  ]);
}

/**
 * An animated sticker (backlog 31) plays for a while and stops, like WhatsApp:
 * a chat full of loops that never end is noise and costs battery. A tap on a
 * stopped one plays it again.
 */
export function useAnimatedStop(url: string | undefined) {
  const ref = useRef<Image>(null);
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);
  const animated = isAnimatedSticker(url);
  useEffect(() => {
    if (!animated) return;
    const timer = setTimeout(() => {
      void ref.current?.stopAnimating();
      setStopped(true);
    }, ANIMATED_STICKER_PLAY_MS);
    return () => clearTimeout(timer);
  }, [animated, round]);
  const replay = () => {
    void ref.current?.startAnimating();
    setStopped(false);
    setRound((before) => before + 1);
  };
  return { ref, stopped: animated && stopped, replay };
}
