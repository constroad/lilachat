import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText, Link as LinkIcon, Play } from 'lucide-react-native';
import { formatChatTimestamp, formatBytes, MEDIA_LIBRARY_TABS, mediaMonthSections, nombreDeContacto, type MediaLibraryItem, type MediaLibraryType } from '@lilachat/shared';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { Segmentado } from '../ui/Segmentado';
import { useColores } from '../ui/tema';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { mediaLibrary } from '../spaces/spacesApi';

/** Thumbnails per row, like WhatsApp's media grid. */
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const SIDE_PADDING = 16;

/**
 * «Medios» (pending 38, José 21/10): photos, videos, documents and links of
 * my chats — the personal ones, or those of the space open — by month. A tap
 * opens the chat at that message.
 */
export function MediaScreen(props: { visible: boolean; jwt: string; spaceId: string | null; spaceName?: string; onOpen: (item: MediaLibraryItem) => void; onClose: () => void }) {
  const colors = useColores();
  const { width } = useWindowDimensions();
  const [type, setType] = useState<MediaLibraryType>('photos');
  const [items, setItems] = useState<MediaLibraryItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const agenda = agendaPorTelefono();

  const load = useCallback(async (before?: string) => {
    const response = await mediaLibrary(props.jwt, { type, spaceId: props.spaceId, before });
    if (!response.ok) return setError(response.message ?? 'No se pudieron cargar los medios.');
    setError('');
    setHasMore(response.data.hasMore);
    setItems((previous) => (before ? [...(previous ?? []), ...response.data.items] : response.data.items));
  }, [props.jwt, props.spaceId, type]);
  useEffect(() => {
    if (!props.visible) return;
    setItems(null);
    void load();
  }, [props.visible, load]);

  const tile = Math.floor((width - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const chatName = (item: MediaLibraryItem) => item.chat.name ?? (nombreDeContacto({ telefono: item.chat.phone, agenda }) || 'Conversación');
  const empty: Record<MediaLibraryType, string> = { photos: 'Todavía no hay fotos.', videos: 'Todavía no hay videos.', files: 'Todavía no hay documentos.', links: 'Todavía no hay enlaces.' };

  return (
    <PantallaEnModal visible={props.visible} titulo={props.spaceName ? `Medios · ${props.spaceName}` : 'Medios'} onCerrar={props.onClose} testIDCerrar="medios-volver">
      <View className="px-4 pb-2">
        <Segmentado<MediaLibraryType> opciones={MEDIA_LIBRARY_TABS.map((tab) => ({ key: tab.type, etiqueta: tab.label, testID: `medios-${tab.type}` }))} valor={type} onCambiar={setType} />
      </View>
      <ScrollView testID="lista-medios" contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, paddingBottom: 32 }}>
        {error ? <Text className="mt-3 text-[13px] text-error">{error}</Text> : null}
        {items === null && !error ? <View className="mt-2 flex-row flex-wrap" style={{ gap: GRID_GAP }}>{[0, 1, 2, 3, 4, 5].map((index) => <View key={index} className="bg-surface-variant" style={{ width: tile, height: tile }} />)}</View> : null}
        {items !== null && items.length === 0 ? <Text className="mt-10 text-center text-[14px] text-on-surface-variant">{empty[type]}</Text> : null}
        {mediaMonthSections(items ?? [], new Date()).map((section) => (
          <View key={section.title}>
            <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{section.title}</Text>
            {type === 'photos' || type === 'videos' ? (
              <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
                {section.items.map((item) => (
                  <Pressable key={`${item.chatId}:${item.seq}`} testID={`medio-${item.seq}`} onPress={() => props.onOpen(item)} accessibilityLabel={`${type === 'photos' ? 'Foto' : 'Video'} de ${chatName(item)}`}>
                    <Image source={{ uri: item.media?.thumbUrl ?? item.media?.url }} style={{ width: tile, height: tile }} contentFit="cover" recyclingKey={`${item.chatId}:${item.seq}`} />
                    {type === 'videos' ? <View className="absolute inset-0 items-center justify-center"><View className="h-9 w-9 items-center justify-center rounded-full bg-black/50"><Play size={18} color="white" /></View></View> : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              section.items.map((item) => (
                <Pressable key={`${item.chatId}:${item.seq}`} testID={`medio-${item.seq}`} onPress={() => props.onOpen(item)} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">{type === 'files' ? <FileText size={20} color={colors.primary} /> : <LinkIcon size={20} color={colors.primary} />}</View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{type === 'files' ? (item.media?.fileName ?? 'Documento') : item.link}</Text>
                    <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{[chatName(item), type === 'files' && item.media?.sizeBytes ? formatBytes(item.media.sizeBytes) : null, formatChatTimestamp(item.at)].filter(Boolean).join(' · ')}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ))}
        {hasMore && items?.length ? (
          <Pressable testID="medios-mas" onPress={() => void load(items.at(-1)!.at)} className="mt-4 min-h-[48px] items-center justify-center rounded-xl border border-outline/20">
            <Text className="text-[15px] font-semibold text-primary">Ver más</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </PantallaEnModal>
  );
}
