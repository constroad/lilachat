import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText, Link as LinkIcon, Play, Search } from 'lucide-react-native';
import { formatChatTimestamp, formatBytes, MEDIA_LIBRARY_TABS, MEDIA_SEARCH_DELAY_MS, mediaEmptyText, mediaMonthSections, mediaSearchTerm, nombreDeContacto, splitMediaSection, type MediaLibraryItem, type MediaLibraryType } from '@lilachat/shared';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { useColores } from '../ui/tema';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { mediaLibrary } from '../spaces/spacesApi';

/** Thumbnails per row, like WhatsApp's media grid. */
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const SIDE_PADDING = 16;

/** The search as typed, sent to the server only after a pause. */
function useSettled(value: string, delayMs: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * «Medios» (pending 38, José 21/10): photos, videos, documents and links of
 * my chats — the personal ones, or those of the space open — by month. «Todo»
 * and the search since pending 6 (design `busqueda-archivos`). A tap opens
 * the chat at that message.
 */
export function MediaScreen(props: { visible: boolean; jwt: string; spaceId: string | null; spaceName?: string; onOpen: (item: MediaLibraryItem) => void; onClose: () => void }) {
  const colors = useColores();
  const { width } = useWindowDimensions();
  const [type, setType] = useState<MediaLibraryType>('all');
  const [search, setSearch] = useState('');
  const term = mediaSearchTerm(useSettled(search, MEDIA_SEARCH_DELAY_MS));
  const [items, setItems] = useState<MediaLibraryItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const agenda = agendaPorTelefono();

  const load = useCallback(async (before?: string) => {
    const response = await mediaLibrary(props.jwt, { type, spaceId: props.spaceId, before, q: term });
    if (!response.ok) return setError(response.message ?? 'No se pudieron cargar los medios.');
    setError('');
    setHasMore(response.data.hasMore);
    setItems((previous) => (before ? [...(previous ?? []), ...response.data.items] : response.data.items));
  }, [props.jwt, props.spaceId, type, term]);
  useEffect(() => {
    if (!props.visible) return;
    setItems(null);
    void load();
  }, [props.visible, load]);

  const tile = Math.floor((width - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const chatName = (item: MediaLibraryItem) => item.chat.name ?? (nombreDeContacto({ telefono: item.chat.phone, agenda }) || 'Conversación');

  return (
    <PantallaEnModal visible={props.visible} titulo={props.spaceName ? `Medios · ${props.spaceName}` : 'Medios'} onCerrar={props.onClose} testIDCerrar="medios-volver">
      <View className="px-4 pb-2">
        <View className="h-11 flex-row items-center gap-2 rounded-full bg-surface-variant px-4">
          <Search size={18} color={colors['on-surface-variant']} />
          <TextInput testID="medios-buscar" value={search} onChangeText={setSearch} placeholder="Buscar en archivos compartidos" placeholderTextColor={colors['on-surface-variant']} returnKeyType="search" className="flex-1 text-[15px] text-on-surface" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
          {MEDIA_LIBRARY_TABS.map((tab) => (
            <Pressable key={tab.type} testID={`medios-${tab.type}`} accessibilityRole="tab" accessibilityState={{ selected: type === tab.type }} onPress={() => setType(tab.type)} className={`h-9 justify-center rounded-full px-4 ${type === tab.type ? 'bg-primary' : 'bg-primary/10'}`}>
              <Text className={`text-[14px] font-semibold ${type === tab.type ? 'text-on-primary' : 'text-on-surface-variant'}`}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView testID="lista-medios" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, paddingBottom: 32 }}>
        {error ? <Text className="mt-3 text-[13px] text-error">{error}</Text> : null}
        {items === null && !error ? <View className="mt-2 flex-row flex-wrap" style={{ gap: GRID_GAP }}>{[0, 1, 2, 3, 4, 5].map((index) => <View key={index} className="bg-surface-variant" style={{ width: tile, height: tile }} />)}</View> : null}
        {items !== null && items.length === 0 ? <Text className="mt-10 text-center text-[14px] text-on-surface-variant">{mediaEmptyText(type, term ?? '')}</Text> : null}
        {mediaMonthSections(items ?? [], new Date()).map((section) => {
          const { tiles, rows } = splitMediaSection(section.items);
          return (
            <View key={section.title}>
              <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{section.title}</Text>
              {tiles.length ? (
                <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
                  {tiles.map((item) => (
                    <Pressable key={`${item.chatId}:${item.seq}`} testID={`medio-${item.seq}`} onPress={() => props.onOpen(item)} accessibilityLabel={`${item.kind === 'image' ? 'Foto' : 'Video'} de ${chatName(item)}`}>
                      <Image source={{ uri: item.media?.thumbUrl ?? item.media?.url }} style={{ width: tile, height: tile }} contentFit="cover" recyclingKey={`${item.chatId}:${item.seq}`} />
                      {item.kind === 'video' ? <View className="absolute inset-0 items-center justify-center"><View className="h-9 w-9 items-center justify-center rounded-full bg-black/50"><Play size={18} color="white" /></View></View> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {rows.map((item) => (
                <Pressable key={`${item.chatId}:${item.seq}`} testID={`medio-${item.seq}`} onPress={() => props.onOpen(item)} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">{item.kind === 'file' ? <FileText size={20} color={colors.primary} /> : <LinkIcon size={20} color={colors.primary} />}</View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{item.kind === 'file' ? (item.media?.fileName ?? 'Documento') : item.link}</Text>
                    <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{[chatName(item), item.kind === 'file' && item.media?.sizeBytes ? formatBytes(item.media.sizeBytes) : null, formatChatTimestamp(item.at)].filter(Boolean).join(' · ')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          );
        })}
        {hasMore && items?.length ? (
          <Pressable testID="medios-mas" onPress={() => void load(items.at(-1)!.at)} className="mt-4 min-h-[48px] items-center justify-center rounded-xl border border-outline/20">
            <Text className="text-[15px] font-semibold text-primary">Ver más</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </PantallaEnModal>
  );
}
