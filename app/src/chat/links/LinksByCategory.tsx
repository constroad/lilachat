import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { Plus } from 'lucide-react-native';
import { buildCategoryView, type CategoryFilter, type CategoryView, type LinkCategory, type LinkNoteItem } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { useDisposicion } from '../../ui/useDisposicion';
import { useMargenes } from '../../ui/useMargenes';
import { LinkRowCard } from './LinkRowCard';
import { LinkCategoryColumn, LinkChipRow, LinkSectionHeader, LinksEmpty, LinksError, LinksSearch, LinksSkeleton } from './LinksParts';
import { chipRowOf, listRowsOf, rowLayoutsOf, type LinkListRow } from './linkView';
import type { ChatLinksState } from './useChatLinks';

/** A card column needs this much width (dp): a tablet gets two or three. */
const CARD_COLUMN_MIN_WIDTH = 320;
const MAX_CARD_COLUMNS = 3;
const FAB_SIZE = 56;
const FAB_MARGIN = 16;
/** Few rows drawn ahead: 60 links are light, 600 must stay so. */
const LIST_WINDOW = 7;

type Props = {
  state: ChatLinksState;
  onOpen: (item: LinkNoteItem) => void;
  onMore: (item: LinkNoteItem) => void;
  onCategoryActions: (category: LinkCategory) => void;
  /** The «+»: back to «Chat» with the keyboard up. */
  onWrite: () => void;
};

/**
 * «Por categoría» of a notes chat (José 18/11, Stitch nl-01): the search, ONE
 * row of chips with counts and the sections of cards. Landscape and tablet put
 * the categories in a column on the left and the cards in columns, as the
 * desktop design does.
 */
export function LinksByCategory({ state, onOpen, onMore, onCategoryActions, onWrite }: Props) {
  const layout = useDisposicion();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<CategoryFilter>('all');
  const links = state.links;
  const view = useMemo(() => (links ? buildCategoryView(links.items, links.categories, { query, only: picked }) : null), [links, query, picked]);
  const chips = useMemo(() => (view ? chipRowOf(view) : []), [view]);
  // A merged category's chip is gone: back to «Todas».
  if (view && !chips.some((chip) => chip.id === picked)) setPicked('all');
  const holdChip = useCallback((id: string) => {
    const category = links?.categories.find((one) => one.id === id);
    if (category) onCategoryActions(category);
  }, [links, onCategoryActions]);

  if (state.status === 'error' && !links) return <LinksError onRetry={state.reload} />;
  if (!links || !view) return <LinksSkeleton />;
  if (links.items.length === 0) return <LinksEmpty />;

  const search = (
    <View className="px-4 pb-2 pt-3">
      <LinksSearch query={query} onChange={setQuery} />
    </View>
  );
  const list = <LinkSections view={view} only={picked} query={query} wide={layout.amplia} onShowAll={setPicked} onOpen={onOpen} onMore={onMore} />;
  return (
    <View testID="vista-por-categoria" className="flex-1">
      {layout.amplia ? (
        <View className="flex-1 flex-row">
          <LinkCategoryColumn chips={chips} only={picked} onPick={setPicked} onHold={holdChip} />
          <View className="flex-1">{search}{list}</View>
        </View>
      ) : (
        <>
          {search}
          <View className="pb-2"><LinkChipRow chips={chips} only={picked} onPick={setPicked} onHold={holdChip} /></View>
          {list}
        </>
      )}
      <WriteButton onWrite={onWrite} />
    </View>
  );
}

type SectionsProps = { view: CategoryView; only: CategoryFilter; query: string; wide: boolean; onShowAll: (id: string) => void; onOpen: (item: LinkNoteItem) => void; onMore: (item: LinkNoteItem) => void };

/** The sections and their cards: a virtualized list whose rows are never measured. */
function LinkSections({ view, only, query, wide, onShowAll, onOpen, onMore }: SectionsProps) {
  const [listWidth, setListWidth] = useState(0);
  const columns = wide ? Math.min(MAX_CARD_COLUMNS, Math.max(1, Math.floor(listWidth / CARD_COLUMN_MIN_WIDTH))) : 1;
  const rows = useMemo(() => listRowsOf(view, { only, query, columns }), [view, only, query, columns]);
  const layouts = useMemo(() => rowLayoutsOf(rows), [rows]);
  const renderRow = useCallback(({ item: row }: { item: LinkListRow }) =>
    row.kind === 'header' ? (
      <LinkSectionHeader row={row} onShowAll={onShowAll} />
    ) : (
      <View className="flex-row gap-3 pb-2">
        {row.items.map((one) => <LinkRowCard key={one.seq} item={one} onOpen={onOpen} onMore={onMore} />)}
        {Array.from({ length: columns - row.items.length }, (_, index) => <View key={index} className="flex-1" />)}
      </View>
    ), [onShowAll, onOpen, onMore, columns]);
  return (
    <FlatList
      testID="lista-de-enlaces"
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderRow}
      getItemLayout={(_, index) => ({ ...layouts[index]!, index })}
      windowSize={LIST_WINDOW}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: FAB_SIZE + FAB_MARGIN * 2 }}
      ListEmptyComponent={<Text className="px-2 pt-6 text-center text-[14px] text-on-surface-variant">{`Nada coincide con «${query.trim()}».`}</Text>}
      onLayout={(event: LayoutChangeEvent) => setListWidth(event.nativeEvent.layout.width)}
    />
  );
}

/** The «+» of the design: back to «Chat» to write or paste a link. */
function WriteButton({ onWrite }: { onWrite: () => void }) {
  const margins = useMargenes();
  const colors = useColores();
  return (
    <Pressable
      testID="fab-escribir-nota"
      accessibilityLabel="Escribir en el chat"
      onPress={onWrite}
      style={{ width: FAB_SIZE, height: FAB_SIZE, right: FAB_MARGIN, bottom: FAB_MARGIN + margins.pie }}
      className="absolute items-center justify-center rounded-full bg-primary shadow-lg"
    >
      <Plus size={26} color={colors['on-primary']} />
    </Pressable>
  );
}
