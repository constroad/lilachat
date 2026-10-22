import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Search } from 'lucide-react-native';
import { GIF_SUGGESTIONS, type GifResult } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { searchGifs, sendGif } from './gifsApi';

const SEARCH_DEBOUNCE_MS = 400;
const TILE_HEIGHT = 120;
const PAGE = 24;
/** «Tendencias» is the empty search: GIPHY's trending. */
const CHIPS = [{ label: 'Tendencias', q: '' }, ...GIF_SUGGESTIONS.map((label) => ({ label, q: label }))];

function useGifSearch(jwt: string, q: string) {
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

/**
 * The «GIF» tab of the panel (backlog 37, José 21/10; design
 * `g-01-panel-gif-giphy`): search, suggestion chips, a grid of moving
 * previews, and «Powered by GIPHY», as its license asks. A tap sends it.
 */
export function GifPanel(props: { jwt: string; chatId: string }) {
  const colors = useColores();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { gifs, failed, more } = useGifSearch(props.jwt, text.trim());
  const send = async (gif: GifResult) => {
    setError(null);
    const result = await sendGif(props.jwt, props.chatId, gif.id, `gif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    if (!result.ok) setError(result.message ?? 'No se pudo mandar el GIF.');
  };
  return (
    <View testID="panel-gif" style={{ flex: 1 }}>
      <View className="mx-3 mt-2 h-10 flex-row items-center gap-2 rounded-full border border-outline/20 bg-surface px-3">
        <Search size={16} color={colors['on-surface-variant']} />
        <TextInput testID="buscar-gif" value={text} onChangeText={setText} placeholder="Buscar GIF" placeholderTextColor={colors.outline} className="min-w-0 flex-1 text-[15px] text-on-surface" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
        {CHIPS.map((chip) => {
          const active = text.trim() === chip.q;
          return (
            <Pressable key={chip.label} testID={`chip-gif-${chip.label}`} onPress={() => setText(chip.q)} className={`h-8 justify-center rounded-full border px-3 ${active ? 'border-primary/40 bg-primary/10' : 'border-outline/20 bg-surface'}`}>
              <Text className={`text-[13px] ${active ? 'font-semibold text-primary' : 'text-on-surface'}`}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <Text className="px-4 pb-1 text-[13px] text-error">{error}</Text> : null}
      {gifs === null ? (
        failed ? <Text className="p-4 text-center text-[13px] text-on-surface-variant">GIPHY no respondió. Inténtalo de nuevo.</Text> : <ActivityIndicator className="mt-6" color={colors.primary} />
      ) : (
        <FlatList
          data={gifs}
          numColumns={2}
          keyExtractor={(gif) => gif.id}
          onEndReached={more}
          onEndReachedThreshold={0.5}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          ListEmptyComponent={<Text className="p-4 text-center text-[13px] text-on-surface-variant">No encontramos GIF con eso.</Text>}
          renderItem={({ item }) => (
            <Pressable testID={`gif-${item.id}`} accessibilityLabel={item.title || 'GIF'} onPress={() => void send(item)} className="flex-1 p-1">
              {/* The tile keeps its place (and a tint) while the preview loads. */}
              <View className="overflow-hidden rounded-lg bg-surface-variant" style={{ height: TILE_HEIGHT }}>
                <Image source={{ uri: item.previewUrl }} style={{ width: '100%', height: TILE_HEIGHT }} contentFit="cover" recyclingKey={item.id} />
              </View>
            </Pressable>
          )}
        />
      )}
      <Text className="py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Powered by GIPHY</Text>
    </View>
  );
}
