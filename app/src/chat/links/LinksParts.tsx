import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowRight, Link2, RotateCw, Search, X } from 'lucide-react-native';
import type { CategoryFilter } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { LINK_CARD_HEIGHT } from './LinkRowCard';
import type { LinkChip, LinkListRow } from './linkView';

/**
 * The pieces of «Por categoría» (Stitch nl-01): search, chips, the section
 * kicker and the loading, empty and error states.
 */
const SKELETON_CARDS = 3;
const CHIP_LONG_PRESS_MS = 400;
/** The categories column of landscape and tablet (dp). */
const CATEGORY_COLUMN_WIDTH = 260;
/** Three chips of different names while it loads (dp). */
const SKELETON_CHIP_WIDTHS = [88, 140, 120];

export function LinksSearch({ query, onChange }: { query: string; onChange: (text: string) => void }) {
  const colors = useColores();
  return (
    <View className="min-h-[56px] flex-row items-center gap-3 rounded-xl bg-surface px-2 shadow-sm">
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/[0.07]">
        <Search size={20} color={colors['on-surface-variant']} />
      </View>
      <View className="min-w-0 flex-1 py-1">
        <TextInput
          testID="buscar-enlaces"
          value={query}
          onChangeText={onChange}
          placeholder="Buscar en tus enlaces"
          placeholderTextColor={colors['on-surface-variant']}
          returnKeyType="search"
          className="min-h-[28px] p-0 text-[15px] text-on-surface"
        />
        <Text numberOfLines={1} className="text-[12px] text-on-surface-variant">
          por autor, descripción o texto del post
        </Text>
      </View>
      {query ? (
        <Pressable testID="limpiar-busqueda-enlaces" accessibilityLabel="Limpiar la búsqueda" onPress={() => onChange('')} className="h-12 w-12 items-center justify-center">
          <X size={18} color={colors['on-surface-variant']} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ChipProps = { chip: LinkChip; active: boolean; onPick: (id: CategoryFilter) => void; onHold?: (id: string) => void };

function Chip({ chip, active, onPick, onHold }: ChipProps) {
  const tint = chip.review ? (chip.id === 'unreadable' ? 'text-error' : 'text-warning') : 'text-on-surface-variant';
  return (
    <Pressable
      testID={`chip-enlaces-${chip.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onPick(chip.id)}
      onLongPress={onHold ? () => onHold(chip.id) : undefined}
      delayLongPress={CHIP_LONG_PRESS_MS}
      className={`min-h-[40px] flex-row items-center gap-1.5 rounded-xl px-4 shadow-sm ${active ? 'bg-primary' : 'bg-surface'}`}
    >
      <Text className={`text-[14px] ${active ? 'font-bold text-on-primary' : 'font-medium text-on-surface'}`}>{chip.name}</Text>
      <Text className={`text-[12px] ${active ? 'text-on-primary' : tint}`}>{chip.count}</Text>
    </Pressable>
  );
}

const isCategory = (id: string) => !['all', 'none', 'commentBait', 'unreadable'].includes(id);

/** ONE row of chips that scrolls sideways; a long press on a category renames or merges it. */
export function LinkChipRow({ chips, only, onPick, onHold }: { chips: readonly LinkChip[]; only: CategoryFilter; onPick: (id: CategoryFilter) => void; onHold: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4, alignItems: 'center' }}>
      {chips.map((chip) => (
        <Chip key={chip.id} chip={chip} active={only === chip.id} onPick={onPick} onHold={isCategory(chip.id) ? onHold : undefined} />
      ))}
    </ScrollView>
  );
}

/** The categories as a column (landscape and tablet, Stitch nl-01 escritorio): categories, then «REVISIÓN». */
export function LinkCategoryColumn({ chips, only, onPick, onHold }: { chips: readonly LinkChip[]; only: CategoryFilter; onPick: (id: CategoryFilter) => void; onHold: (id: string) => void }) {
  const review = chips.filter((chip) => chip.review);
  const row = (chip: LinkChip) => (
    <Pressable
      key={chip.id}
      testID={`columna-enlaces-${chip.id}`}
      accessibilityState={{ selected: only === chip.id }}
      onPress={() => onPick(chip.id)}
      onLongPress={isCategory(chip.id) ? () => onHold(chip.id) : undefined}
      delayLongPress={CHIP_LONG_PRESS_MS}
      className={`min-h-[48px] flex-row items-center justify-between rounded-lg px-3 ${only === chip.id ? 'bg-primary/[0.10]' : ''}`}
    >
      <Text numberOfLines={1} className={`min-w-0 flex-1 text-[15px] ${only === chip.id ? 'font-semibold text-primary' : 'text-on-surface'}`}>{chip.name}</Text>
      <Text className={`text-[13px] ${chip.id === 'unreadable' ? 'text-error' : chip.review ? 'text-warning' : 'text-on-surface-variant'}`}>{chip.count}</Text>
    </Pressable>
  );
  return (
    <ScrollView className="border-r border-outline/10" style={{ width: CATEGORY_COLUMN_WIDTH, flexGrow: 0 }} contentContainerStyle={{ padding: 12, gap: 2 }}>
      <Text className="px-3 pb-2 text-[12px] font-bold tracking-wider text-on-surface-variant">CATEGORÍAS</Text>
      {chips.filter((chip) => !chip.review).map(row)}
      {review.length ? <Text className="px-3 pb-2 pt-5 text-[12px] font-bold tracking-wider text-on-surface-variant">REVISIÓN</Text> : null}
      {review.map(row)}
    </ScrollView>
  );
}

/** «● PUBLICIDAD Y VENTAS · 5» and, in «Todas», «Ver las 5 →». */
export function LinkSectionHeader({ row, onShowAll }: { row: Extract<LinkListRow, { kind: 'header' }>; onShowAll: (id: string) => void }) {
  const colors = useColores();
  return (
    <View className="h-[44px] flex-row items-center justify-between px-1">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <View className="h-1.5 w-1.5 rounded-full bg-primary" />
        <Text numberOfLines={1} className="shrink text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">{`${row.name} · ${row.count}`}</Text>
      </View>
      {row.showAll ? (
        <Pressable testID={`ver-todas-${row.id}`} onPress={() => onShowAll(row.id)} hitSlop={8} className="min-h-[44px] flex-row items-center gap-0.5 pl-3">
          <Text className="text-[13px] font-semibold text-primary">{`Ver las ${row.count}`}</Text>
          <ArrowRight size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The real geometry while it loads: search, chips, a kicker and three cards. */
export function LinksSkeleton() {
  return (
    <View testID="enlaces-cargando" className="gap-3 px-4 pt-3">
      <View className="h-[56px] rounded-xl bg-on-surface/[0.06]" />
      <View className="flex-row gap-2">
        {SKELETON_CHIP_WIDTHS.map((width) => <View key={width} style={{ width }} className="h-10 rounded-xl bg-on-surface/[0.06]" />)}
      </View>
      <View className="mt-2 h-3 w-40 rounded bg-on-surface/[0.06]" />
      {Array.from({ length: SKELETON_CARDS }, (_, index) => <View key={index} style={{ height: LINK_CARD_HEIGHT }} className="rounded-xl bg-on-surface/[0.06]" />)}
    </View>
  );
}

export function LinksEmpty() {
  const colors = useColores();
  return (
    <View testID="enlaces-vacio" className="flex-1 items-center justify-center gap-2 px-8">
      <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl bg-primary/[0.10]">
        <Link2 size={28} color={colors.primary} />
      </View>
      <Text className="text-center text-[17px] font-semibold text-on-surface">Todavía no hay enlaces guardados</Text>
      <Text className="text-center text-[14px] text-on-surface-variant">Comparte un reel o pega un enlace en el chat.</Text>
    </View>
  );
}

export function LinksError({ onRetry }: { onRetry: () => void }) {
  const colors = useColores();
  return (
    <View testID="enlaces-error" className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center text-[15px] text-on-surface">No se pudieron cargar tus enlaces.</Text>
      <Pressable testID="reintentar-enlaces" onPress={onRetry} className="min-h-[48px] flex-row items-center gap-2 rounded-full bg-primary/[0.10] px-5">
        <RotateCw size={16} color={colors.primary} />
        <Text className="text-[15px] font-semibold text-primary">Reintentar</Text>
      </Pressable>
    </View>
  );
}
