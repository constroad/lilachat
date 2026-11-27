import { Mic } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { GIF_SUGGESTIONS, type GifResult, type MessageTarget } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { searchGifs, sendGif } from './gifsApi';
import { addMediaInFlight, gifAsQueuedFile, HANDOVER_MS, removeMediaInFlight } from './gifsInFlight';
import { beginInteraction, SEND_FRAME_WINDOW_MS } from '../../diagnostico/frameMonitor';

const SEARCH_DEBOUNCE_MS = 400;
const TILE_HEIGHT = 120;
const PAGE = 24;
/** After the server answered, the pending bubble waits this much for the real one (the socket echo) before going. */
/** «Tendencias» is the empty search: GIPHY's trending. */
export const GIF_CHIPS = [{ label: 'Tendencias', q: '' }, ...GIF_SUGGESTIONS.map((label) => ({ label, q: label }))];

export function useGifSearch(jwt: string, q: string) {
  const [gifs, setGifs] = useState<GifResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = useRef(false);
  const load = useCallback(async (offset: number) => {
    if (loading.current) return;
    loading.current = true;
    const result = await searchGifs(jwt, q, offset);
    loading.current = false;
    if (!result.ok) return setFailed(true);
    setFailed(false);
    setGifs((before) => (offset === 0 ? result.data.gifs : [...(before ?? []), ...result.data.gifs]));
  }, [jwt, q]);
  useEffect(() => {
    setGifs(null);
    const timer = setTimeout(() => void load(0), q ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [load, q]);
  return { gifs, failed, more: () => gifs && gifs.length % PAGE === 0 && void load(gifs.length) };
}

/** Sends a GIF and shows it in the chat at once; answers the error to show, if any. */
/** `target`: the answer or the thread, read when the GIF is tapped (José 10/11); `onSent` closes the quote. */
export function useGifSend(jwt: string, chatId: string, target?: () => MessageTarget, onSent?: () => void) {
  const [error, setError] = useState<string | null>(null);
  const send = async (gif: GifResult) => {
    setError(null);
    beginInteraction('enviar-gif', SEND_FRAME_WINDOW_MS);
    const clientKey = `gif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // In the chat at once, as GIPHY's preview «sending» (22/10): the server takes a few seconds to store it.
    const where = target?.() ?? {};
    addMediaInFlight(chatId, gifAsQueuedFile(gif, chatId, clientKey, new Date().toISOString(), where));
    const result = await sendGif(jwt, chatId, gif.id, clientKey, where);
    if (!result.ok) {
      removeMediaInFlight(clientKey);
      setError(result.message ?? 'No se pudo mandar el GIF.');
      return false;
    }
    // The real message arrived by the socket by now (or arrives in a moment): it takes the bubble's place.
    setTimeout(() => removeMediaInFlight(clientKey), HANDOVER_MS);
    onSent?.();
    return true;
  };
  return { send, error };
}

/** The suggestion chips: «Tendencias» and GIPHY's usual searches. */
export function GifChips(props: { query: string; onPick: (q: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
      {GIF_CHIPS.map((chip) => {
        const active = props.query === chip.q;
        return (
          <Pressable key={chip.label} testID={`chip-gif-${chip.label}`} onPress={() => props.onPick(chip.q)} className={`h-8 justify-center rounded-full border px-3 ${active ? 'border-primary/40 bg-primary/10' : 'border-outline/20 bg-surface'}`}>
            <Text className={`text-[13px] ${active ? 'font-semibold text-primary' : 'text-on-surface'}`}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The grid of moving previews, with its loading, failure and empty states. */
export function GifGrid(props: {
  search: ReturnType<typeof useGifSearch>;
  columns: number;
  onPick: (gif: GifResult) => void;
  /** José 27/11 (design sa-04): its «+ Sonido», and a long press for the choice. */
  onSoundSticker?: (gif: GifResult) => void;
  onLongPress?: (gif: GifResult) => void;
  /** The GIF whose editor is opening: its tile says so and does not send. */
  opening?: string | null;
}) {
  const colors = useColores();
  const { gifs, failed, more } = props.search;
  if (gifs === null) return failed ? <Text className="p-4 text-center text-[13px] text-on-surface-variant">GIPHY no respondió. Inténtalo de nuevo.</Text> : <ActivityIndicator className="mt-6" color={colors.primary} />;
  return (
    <FlatList
      key={props.columns}
      data={gifs}
      numColumns={props.columns}
      keyExtractor={(gif) => gif.id}
      onEndReached={more}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 8 }}
      ListEmptyComponent={<Text className="p-4 text-center text-[13px] text-on-surface-variant">No encontramos GIF con eso.</Text>}
      renderItem={({ item }) => (
        <View className="flex-1 p-1" style={{ maxWidth: `${100 / props.columns}%` }}>
          <Pressable testID={`gif-${item.id}`} accessibilityLabel={item.title || 'GIF'} disabled={props.opening === item.id} onPress={() => props.onPick(item)} onLongPress={props.onLongPress ? () => props.onLongPress?.(item) : undefined}>
            {/* The tile keeps its place (and a tint) while the preview loads. */}
            <View className="overflow-hidden rounded-lg bg-surface-variant" style={{ height: TILE_HEIGHT }}>
              <Image source={{ uri: item.sharpUrl ?? item.previewUrl }} style={{ width: '100%', height: TILE_HEIGHT }} contentFit="cover" recyclingKey={item.id} />
            </View>
          </Pressable>
          {props.onSoundSticker ? <SoundStickerPill gifId={item.id} opening={props.opening === item.id} onPress={() => props.onSoundSticker?.(item)} /> : null}
        </View>
      )}
    />
  );
}

/**
 * «+ Sonido» over a GIF (José 27/11: a lone note read as «this GIF has sound», and the tap sent it). A sibling of the
 * tile, not inside it, so its tap never reaches the tile's «send»; it says when the editor is opening.
 */
function SoundStickerPill(props: { gifId: string; opening: boolean; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable
      testID={`sticker-sonido-${props.gifId}`}
      accessibilityRole="button"
      accessibilityLabel="Hacer sticker con sonido"
      accessibilityState={{ busy: props.opening }}
      disabled={props.opening}
      hitSlop={6}
      onPress={props.onPress}
      className="absolute bottom-2 right-2 h-8 flex-row items-center gap-1 rounded-full bg-surface/95 px-2.5"
    >
      {props.opening ? <ActivityIndicator size="small" color={colors.primary} /> : <Mic size={14} color={colors.primary} />}
      <Text className="text-[12px] font-semibold text-primary">{props.opening ? 'Abriendo…' : '+ Sonido'}</Text>
    </Pressable>
  );
}
