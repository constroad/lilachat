import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Clock3, Flag, Hand, Lightbulb, PawPrint, Pizza, Plane, Search, Shapes, Smile, Trophy } from 'lucide-react-native';
import { emojisByCategory } from 'rn-emoji-keyboard';
import { loadEmojiNames, searchEmojis, type EmojiName } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { emojiLayout, recentEmojis, sectionAtOffset, type EmojiRow, type EmojiSection } from './emojiPanel/emojiLayout';

const RECENTS_KEY = 'lilachat.emojis.recientes';
const RECENTS_LIMIT = 32;
const SEARCH_LIMIT = 64;
/** Eight per row and a big glyph, like WhatsApp. */
const COLUMNS = 8;
const HEADER_HEIGHT = 32;
const GLYPH_SIZE = 28;

const CATEGORIES: { key: string; title: string; Icon: typeof Smile }[] = [
  { key: 'recently_used', title: 'Recientes', Icon: Clock3 },
  { key: 'smileys_emotion', title: 'Caras y emociones', Icon: Smile },
  { key: 'people_body', title: 'Personas', Icon: Hand },
  { key: 'animals_nature', title: 'Animales y naturaleza', Icon: PawPrint },
  { key: 'food_drink', title: 'Comida y bebida', Icon: Pizza },
  { key: 'travel_places', title: 'Viajes y lugares', Icon: Plane },
  { key: 'activities', title: 'Actividades', Icon: Trophy },
  { key: 'objects', title: 'Objetos', Icon: Lightbulb },
  { key: 'symbols', title: 'Símbolos', Icon: Shapes },
  { key: 'flags', title: 'Banderas', Icon: Flag },
];

/** The catalog, read once: only the glyphs travel to the list. */
const CATALOG = new Map(emojisByCategory.map((category) => [category.title as string, category.data.map((one) => one.emoji)]));

/** Recents survive closing the app, like WhatsApp. Not secret: AsyncStorage is enough. */
function useRecents() {
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY)
      .then((stored) => setRecents(recentEmojis(stored ? JSON.parse(stored) : [], RECENTS_LIMIT)))
      .catch(() => setRecents([]));
  }, []);
  const remember = useCallback((emoji: string) => {
    setRecents((before) => {
      const next = [emoji, ...before.filter((one) => one !== emoji)].slice(0, RECENTS_LIMIT);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  return { recents, remember };
}

/** Spanish and English names, loaded the first time someone searches. */
function useEmojiSearch(query: string): string[] | null {
  const [table, setTable] = useState<EmojiName[] | null>(null);
  useEffect(() => {
    if (query.trim() && !table) void loadEmojiNames().then(setTable);
  }, [query, table]);
  return useMemo(() => (query.trim() && table ? searchEmojis(table, query.trim(), SEARCH_LIMIT) : null), [query, table]);
}

/**
 * The emoji panel (José, 18/10), in place of the keyboard. Since 02/11 every
 * category is in ONE scroll, like WhatsApp: the bar on top jumps to a category
 * and follows the scroll. Recents first, and a search in Spanish or English.
 */
export function PanelDeEmojis({ onElegir }: { onElegir: (emoji: string) => void }) {
  const colors = useColores();
  const { width } = useWindowDimensions();
  const cell = Math.floor(width / COLUMNS);
  const { recents, remember } = useRecents();
  const [query, setQuery] = useState('');
  const found = useEmojiSearch(query);
  const list = useRef<FlatList<EmojiRow>>(null);
  const [active, setActive] = useState<string | null>(null);

  const layout = useMemo(() => {
    const sections: EmojiSection[] = found
      ? [{ key: 'search', title: found.length ? 'Resultados' : 'Sin resultados', emojis: found.length ? found : [' '] }]
      : CATEGORIES.map(({ key, title }) => ({ key, title, emojis: key === 'recently_used' ? recents : (CATALOG.get(key) ?? []) }));
    return emojiLayout(sections, { columns: COLUMNS, rowHeight: cell, headerHeight: HEADER_HEIGHT });
  }, [found, recents, cell]);
  const pick = useCallback((emoji: string) => {
    if (!emoji.trim()) return;
    remember(emoji);
    onElegir(emoji);
  }, [remember, onElegir]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const key = sectionAtOffset(layout.sections, event.nativeEvent.contentOffset.y + 1);
    setActive((before) => (before === key ? before : key));
  };
  const jump = (key: string) => {
    const start = layout.sections.find((section) => section.key === key);
    if (start) list.current?.scrollToOffset({ offset: start.offset, animated: false });
    setActive(key);
  };
  const shown = active ?? layout.sections[0]?.key;

  return (
    <View testID="panel-emojis" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View className="mx-3 mt-2 h-10 flex-row items-center gap-2 rounded-full px-3" style={{ backgroundColor: colors['surface-variant'] }}>
        <Search size={16} color={colors['on-surface-variant']} />
        <TextInput testID="buscar-emoji" value={query} onChangeText={setQuery} placeholder="Buscar emoji" placeholderTextColor={colors['on-surface-variant']} className="flex-1 py-0 text-[15px]" style={{ color: colors['on-surface'] }} />
      </View>
      {found ? null : (
        <View className="flex-row justify-between px-2 pt-1">
          {CATEGORIES.filter(({ key }) => layout.sections.some((section) => section.key === key)).map(({ key, title, Icon }) => (
            <Pressable key={key} testID={`categoria-emoji-${key}`} accessibilityLabel={title} accessibilityState={{ selected: shown === key }} onPress={() => jump(key)} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: shown === key ? colors['surface-variant'] : 'transparent' }}>
              <Icon size={18} color={shown === key ? colors.primary : colors['on-surface-variant']} />
            </Pressable>
          ))}
        </View>
      )}
      <FlatList
        ref={list}
        data={layout.rows}
        keyExtractor={(row) => row.key}
        getItemLayout={(_data, index) => ({ length: layout.rows[index]!.height, offset: layout.rows[index]!.offset, index })}
        renderItem={({ item }) => <EmojiListRow row={item} cell={cell} onPick={pick} headerColor={colors['on-surface-variant']} />}
        onScroll={onScroll}
        scrollEventThrottle={64}
        keyboardShouldPersistTaps="always"
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}

function EmojiListRow(props: { row: EmojiRow; cell: number; onPick: (emoji: string) => void; headerColor: string }) {
  const { row, cell } = props;
  if (row.kind === 'header') {
    return (
      <Text className="px-3 pt-3 text-[12px] font-semibold" style={{ height: row.height, color: props.headerColor }}>
        {row.title}
      </Text>
    );
  }
  return (
    <View className="flex-row px-0" style={{ height: row.height }}>
      {row.emojis.map((emoji, index) => (
        <Pressable key={`${emoji}-${index}`} onPress={() => props.onPick(emoji)} android_ripple={{ borderless: true, radius: cell / 2 }} className="items-center justify-center" style={{ width: cell, height: cell }}>
          <Text style={{ fontSize: GLYPH_SIZE }}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}
