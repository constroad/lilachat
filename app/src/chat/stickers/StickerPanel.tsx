import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Clock3, FolderHeart, Star, WandSparkles } from 'lucide-react-native';
import { stickerSections, type LibrarySticker, type StickerSection } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { StickersState } from './useStickers';

type Filter = 'all' | 'recent' | 'favorites' | 'mine';
const COLUMNS = 4;
const GAP = 8;
/** «Mis stickers» shows two rows; «Ver todos» opens the rest (design). */
const COLLAPSED_MINE = 7;
const FILTERS: { key: Exclude<Filter, 'all'>; label: string; Icon: typeof Clock3 }[] = [
  { key: 'recent', label: 'Recientes', Icon: Clock3 },
  { key: 'favorites', label: 'Favoritos', Icon: Star },
  { key: 'mine', label: 'Mis stickers', Icon: FolderHeart },
];

/**
 * The Stickers tab of the panel (José, 20/10; design `s1-app-panel-stickers`),
 * like WhatsApp: Recientes, Favoritos, Mis stickers, the default pack, and
 * «Crear» first. A tap sends; a long press offers favorite or removal.
 */
export function StickerPanel(props: { stickers: StickersState; onSend: (sticker: LibrarySticker) => void; onCreate: () => void }) {
  const colors = useColores();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [allMine, setAllMine] = useState(false);
  const { library, recents, packs } = props.stickers;
  const side = (width - GAP * (COLUMNS + 1)) / COLUMNS;
  const sections = stickerSections({ library: library ?? [], recents, packs });
  const visible = filter === 'all' ? sections : sections.filter((section) => section.key === filter);
  const showOptions = (sticker: LibrarySticker) => {
    const isPack = sticker.id.startsWith('pack:');
    Alert.alert('Sticker', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: sticker.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos', onPress: () => void props.stickers.toggleFavorite(sticker) },
      ...(isPack ? [] : [{ text: 'Quitar de Mis stickers', style: 'destructive' as const, onPress: () => void props.stickers.remove(sticker) }]),
    ]);
  };
  const shown = (section: StickerSection) => (section.key === 'mine' && !allMine && filter === 'all' ? section.stickers.slice(0, COLLAPSED_MINE) : section.stickers);

  return (
    <View testID="panel-stickers" className="flex-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }} style={{ flexGrow: 0 }}>
        {FILTERS.map(({ key, label, Icon }) => {
          const active = filter === key;
          return (
            <Pressable key={key} testID={`filtro-stickers-${key}`} onPress={() => setFilter(active ? 'all' : key)} className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full border px-3 ${active ? 'border-primary/40 bg-primary/10' : 'border-outline/20 bg-surface'}`}>
              <Icon size={15} color={active ? colors.primary : colors['on-surface-variant']} />
              <Text className={`text-[13px] ${active ? 'font-semibold text-primary' : 'text-on-surface'}`}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {library === null ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: GAP, paddingBottom: 12 }}>
          {visible.map((section, index) => (
            <View key={section.key} testID={`seccion-stickers-${section.key}`}>
              <View className="flex-row items-center justify-between px-1 pb-2 pt-2">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{section.title}</Text>
                {section.key === 'mine' && filter === 'all' && section.stickers.length > COLLAPSED_MINE ? (
                  <Pressable testID="btn-ver-todos-stickers" onPress={() => setAllMine((before) => !before)} hitSlop={8}>
                    <Text className="text-[12px] font-semibold text-primary">{allMine ? 'Ver menos' : 'Ver todos'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View className="flex-row flex-wrap" style={{ gap: GAP }}>
                {index === 0 ? (
                  <Pressable testID="btn-crear-sticker" onPress={props.onCreate} className="items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5" style={{ width: side, height: side }}>
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-primary"><WandSparkles size={18} color="white" /></View>
                    <Text className="mt-1 text-[12px] font-semibold text-primary">Crear</Text>
                  </Pressable>
                ) : null}
                {shown(section).map((sticker) => (
                  <Pressable key={`${section.key}-${sticker.id}`} testID={`sticker-${section.key}-${sticker.id}`} accessibilityLabel="Mandar el sticker" onPress={() => props.onSend(sticker)} onLongPress={() => showOptions(sticker)} className="items-center justify-center rounded-2xl border border-outline/10 bg-surface" style={{ width: side, height: side }}>
                    <Image source={{ uri: sticker.url }} style={{ width: side - 14, height: side - 14 }} contentFit="contain" recyclingKey={sticker.id} />
                  </Pressable>
                ))}
              </View>
              {section.key === 'mine' && section.stickers.length === 0 ? (
                <Text className="px-1 pt-3 text-[13px] text-on-surface-variant">Crea tu primer sticker desde una foto: se quita el fondo y le pones letras.</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
      {props.stickers.error ? <Text className="px-4 pb-2 text-[12px] text-error">{props.stickers.error}</Text> : null}
    </View>
  );
}
