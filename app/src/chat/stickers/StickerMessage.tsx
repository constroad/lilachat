import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, ToastAndroid, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ANIMATED_STICKER_PLAY_MS, formatClock, lottieUrlOf, stickerIsAnimated, type DeliveryState } from '@lilachat/shared';
import { LottieStickerView, useLottieStop } from './LottieStickerView';
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

type StickerProps = {
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
};

export function StickerMessage(props: StickerProps) {
  const { item, mine } = props;
  return (
    <DeslizarParaResponder habilitado={!props.selecting && Boolean(props.onReply)} onResponder={() => props.onReply?.(item.seq, 'Sticker', mine)}>
      <View testID={`sticker-${item.seq}`} className={`-mx-3 flex-row items-end gap-2 px-3 pt-3 ${mine ? 'justify-end' : ''} ${props.selected ? 'bg-primary/15' : ''}`}>
        {props.author ? <Avatar nombre={props.author.name} foto={props.author.photo} tamano={AVATAR_DE_AUTOR} /> : null}
        <View>
          {props.author?.name ? <Text className="mb-0.5 px-1 text-[13px] font-semibold text-on-surface-variant" numberOfLines={1}>{props.author.name}</Text> : null}
          {props.quote ? <View className="mb-1 rounded-xl border border-outline/15 bg-surface px-2 pb-1 pt-2" style={{ maxWidth: SIDE + QUOTE_EXTRA_WIDTH }}>{props.quote}</View> : null}
          <StickerCell item={item} mine={mine} jwt={props.jwt} delivery={props.delivery} starred={props.starred} side={SIDE} selecting={props.selecting} onSelect={props.onSelect} />
        </View>
      </View>
    </DeslizarParaResponder>
  );
}

/** Room the row keeps for its margins and the gap between the two. */
const PAIR_CHROME = 32;

/**
 * Two stickers one person sent in a row, side by side (José, 02/11, like
 * WhatsApp; `stickerRowLayout`). Each keeps its own time, tap and long press;
 * reply goes through the selection bar, since a swipe could not tell which.
 */
export function StickerPair(props: Omit<StickerProps, 'item' | 'quote' | 'selected' | 'starred' | 'delivery'> & { items: readonly [ChatMessage, ChatMessage]; selected: (seq: number) => boolean; starred: (seq: number) => boolean; delivery: (seq: number) => DeliveryState }) {
  const { width } = useWindowDimensions();
  const avatar = props.author ? AVATAR_DE_AUTOR + 8 : 0;
  const side = Math.min(SIDE, Math.floor((width - PAIR_CHROME - avatar) / 2));
  return (
    <View testID={`stickers-${props.items[0].seq}`} className={`-mx-3 flex-row items-end gap-2 px-3 pt-3 ${props.mine ? 'justify-end' : ''}`}>
      {props.author ? <Avatar nombre={props.author.name} foto={props.author.photo} tamano={AVATAR_DE_AUTOR} /> : null}
      <View>
        {props.author?.name ? <Text className="mb-0.5 px-1 text-[13px] font-semibold text-on-surface-variant" numberOfLines={1}>{props.author.name}</Text> : null}
        <View className="flex-row gap-2">
          {props.items.map((item) => (
            <View key={item.seq} testID={`sticker-${item.seq}`} className={`rounded-2xl ${props.selected(item.seq) ? 'bg-primary/15' : ''}`}>
              <StickerCell item={item} mine={props.mine} jwt={props.jwt} delivery={props.delivery(item.seq)} starred={props.starred(item.seq)} side={side} selecting={props.selecting} onSelect={props.onSelect} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * The sticker itself and its time under it: a tap keeps it (or replays it), a
 * long press selects it. Memoized: the pair redraws with every message, its
 * stickers only when theirs changed (F4, 02/11).
 */
const StickerCell = memo(function StickerCell(props: { item: ChatMessage; mine: boolean; jwt: string; delivery: DeliveryState; starred: boolean; side: number; selecting: boolean; onSelect?: (seq: number) => void }) {
  const { item, mine } = props;
  const playback = useStickerPlayback(item.media);
  const showOptions = () => showStickerOptions(props.jwt, item, mine);
  return (
    <>
      <Pressable
        onPress={() => (props.selecting ? props.onSelect?.(item.seq) : playback.stopped ? playback.replay() : showOptions())}
        onLongPress={() => {
          void Haptics.selectionAsync();
          props.onSelect?.(item.seq);
        }}
        delayLongPress={350}
      >
        <StickerArt playback={playback} url={item.media!.url!} side={props.side} recyclingKey={item.clientKey} transition={STICKER_FADE_MS} />
      </Pressable>
      <View className={`mt-0.5 rounded-full bg-black/35 px-1.5 py-0.5 ${mine ? 'self-end' : 'self-start'}`}>
        <MetaDeMensaje hora={formatClock(item.at)} mia={mine} entrega={props.delivery} id={String(item.seq)} sobreFoto destacado={props.starred} />
      </View>
    </>
  );
});

/** A tap on a sticker in the chat: keep it as a favorite, or someone else's in «Mis stickers». */
export function showStickerOptions(jwt: string, item: ChatMessage, mine: boolean): void {
  const keep = async (asFavorite: boolean) => ToastAndroid.show(await keepReceivedSticker(jwt, item.chatId, item.seq, asFavorite), ToastAndroid.SHORT);
  Alert.alert('Sticker', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Agregar a favoritos', onPress: () => void keep(true) },
    ...(mine ? [] : [{ text: 'Guardar en Mis stickers', onPress: () => void keep(false) }]),
  ]);
}

/** Fade-in of a sticker image in the bubble (ms). */
const STICKER_FADE_MS = 120;

/**
 * Which player a sticker uses and its play-then-stop state. The animated pack
 * plays as Lottie (José 11/11, like Telegram); my own animated stickers stay
 * images. Shared by the bubble, the channel row and the thread: on 11/11 only
 * the bubble had Lottie and channels kept playing the old WebP.
 */
export function useStickerPlayback(media: ChatMessage['media'] | null | undefined) {
  const lottieUrl = lottieUrlOf(media?.url) ?? undefined;
  const image = useAnimatedStop(lottieUrl ? undefined : (media?.url ?? undefined), false, !lottieUrl && media?.animated === true);
  const lottie = useLottieStop(Boolean(lottieUrl));
  const replay = () => (lottie.stopped ? lottie.replay() : image.replay());
  return { lottieUrl, lottie, image, stopped: lottie.stopped || image.stopped, replay };
}

export type StickerPlayback = ReturnType<typeof useStickerPlayback>;

/** The sticker itself, with the player `useStickerPlayback` chose. */
export function StickerArt(props: { playback: StickerPlayback; url: string; side: number; recyclingKey: string; transition?: number }) {
  const { playback } = props;
  if (playback.lottieUrl) return <LottieStickerView ref={playback.lottie.ref} lottieUrl={playback.lottieUrl} webpUrl={props.url} side={props.side} />;
  return <Image ref={playback.image.ref} source={{ uri: props.url }} style={{ width: props.side, height: props.side }} contentFit="contain" recyclingKey={props.recyclingKey} transition={props.transition} />;
}

/**
 * An animated sticker (backlog 31) plays for a while and stops, like WhatsApp:
 * a chat full of loops that never end is noise and costs battery. A tap on a
 * stopped one plays it again.
 */
export function useAnimatedStop(url: string | undefined, isGif = false, ownAnimated = false) {
  const ref = useRef<Image>(null);
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);
  // A GIF in a bubble stops the same way (backlog 37).
  const animated = isGif || stickerIsAnimated({ url, animated: ownAnimated });
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
