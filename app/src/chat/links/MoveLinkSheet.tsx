import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowRight, Plus, X } from 'lucide-react-native';
import { MAX_CATEGORY_NAME, type LinkCategory, type LinkNoteItem } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { LinkThumb, PlatformPill } from './LinkCardParts';
import { cardLinesOf, categoryNameProblem, categoryNoteOf } from './linkView';
import type { LinkActionResult } from './useChatLinks';

const MINI_THUMB_WIDTH = 44;
const NONE = 'none';

type Props = {
  item: LinkNoteItem | null;
  categories: readonly LinkCategory[];
  /** Links per category id, `none` for «Sin categoría». */
  counts: ReadonlyMap<string, number>;
  onClose: () => void;
  onMove: (seq: number, categoryId: string | null) => LinkActionResult;
  onCreate: (name: string) => Promise<LinkCategory | string>;
};

/**
 * «Mover de categoría» (Stitch nl-03): the link, who chose its category, the
 * categories with their counts and the current one marked, «Sin categoría»
 * and «Nueva categoría». The person's choice is final: Lila never moves it again.
 */
export function MoveLinkSheet({ item, categories, counts, onClose, onMove, onCreate }: Props) {
  const colors = useColores();
  const current = item?.link.categoryId && categories.some((one) => one.id === item.link.categoryId) ? item.link.categoryId : NONE;
  const [selected, setSelected] = useState(current);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  // Mounted behind the screen: every opening starts from the link it opens for.
  useEffect(() => {
    setSelected(current);
    setProblem('');
    setBusy(false);
  }, [item?.seq, current]);

  const move = async () => {
    if (!item) return;
    setBusy(true);
    const failure = await onMove(item.seq, selected === NONE ? null : selected);
    setBusy(false);
    if (failure) setProblem(failure);
    else onClose();
  };
  const option = (id: string, name: string) => (
    <CategoryOption key={id} id={id} name={name} count={counts.get(id) ?? 0} current={id === current} selected={id === selected} onPick={setSelected} />
  );
  return (
    <Sheet visible={item !== null} onClose={onClose} dragArea="handle" keyboard="avoid" maxHeight="90%" testID="hoja-mover-enlace">
      <View className="flex-row items-start justify-between px-5 pb-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-bold tracking-widest text-primary">MOVER A</Text>
          <Text className="text-[22px] font-bold text-on-surface">¿En qué categoría va?</Text>
        </View>
        <Pressable testID="cerrar-mover-enlace" accessibilityLabel="Cerrar" onPress={onClose} className="h-12 w-12 items-center justify-center rounded-full bg-on-surface/[0.05]">
          <X size={20} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      {item ? <MiniCard item={item} /> : null}
      <ScrollView className="mt-2 border-t border-outline/10" contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
        {categories.map((category) => option(category.id, category.name))}
        {option(NONE, 'Sin categoría')}
        <NewCategory categories={categories} onCreate={onCreate} onCreated={(category) => setSelected(category.id)} />
      </ScrollView>
      {problem ? <Text className="px-5 pb-1 text-[13px] text-error">{problem}</Text> : null}
      <Pressable
        testID="mover-enlace"
        disabled={busy || selected === current}
        onPress={() => void move()}
        className={`mx-4 mt-2 min-h-[56px] flex-row items-center justify-center gap-2 rounded-card bg-primary ${busy || selected === current ? 'opacity-50' : ''}`}
      >
        <Text className="text-[16px] font-bold text-on-primary">Mover</Text>
        <ArrowRight size={18} color={colors['on-primary']} />
      </Pressable>
    </Sheet>
  );
}

function MiniCard({ item }: { item: LinkNoteItem }) {
  const lines = cardLinesOf(item.link);
  const note = categoryNoteOf(item.link);
  return (
    <View className="px-4">
      <View className="flex-row gap-3 rounded-card border border-outline/15 bg-background p-2.5">
        <LinkThumb link={item.link} width={MINI_THUMB_WIDTH} />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="shrink text-[14px] font-bold text-on-surface">{lines.title}</Text>
            <PlatformPill link={item.link} tone="soft" />
          </View>
          <Text numberOfLines={2} className="text-[13px] text-on-surface-variant">{`«${lines.body}»`}</Text>
        </View>
      </View>
      {note ? (
        <View className="flex-row items-center gap-2 px-1 pt-2">
          <View className="h-1.5 w-1.5 rounded-full bg-primary" />
          <Text className="text-[13px] text-on-surface-variant">{note}</Text>
        </View>
      ) : null}
    </View>
  );
}

type OptionProps = { id: string; name: string; count: number; current: boolean; selected: boolean; onPick: (id: string) => void };

/** A radio row of 56 dp; the current category says so. */
function CategoryOption({ id, name, count, current, selected, onPick }: OptionProps) {
  return (
    <Pressable
      testID={`mover-a-${id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => onPick(id)}
      className={`min-h-[56px] flex-row items-center gap-3 rounded-card border px-4 ${selected ? 'border-2 border-primary bg-primary/[0.06]' : 'border-outline/20 bg-surface'}`}
    >
      <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-primary' : 'border-outline/50'}`}>
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`text-[15px] ${selected ? 'font-bold text-primary' : 'font-medium text-on-surface'}`}>{name}</Text>
        {current ? <Text className="text-[11px] font-bold tracking-wider text-primary">CATEGORÍA ACTUAL</Text> : null}
      </View>
      <Text className={`text-[13px] ${selected ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{count}</Text>
    </Pressable>
  );
}

/** «+ Nueva categoría»: an inline field; once created, it is the chosen one. */
function NewCategory({ categories, onCreate, onCreated }: { categories: readonly LinkCategory[]; onCreate: Props['onCreate']; onCreated: (category: LinkCategory) => void }) {
  const colors = useColores();
  const [name, setName] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const create = async () => {
    const local = categoryNameProblem(name ?? '', categories);
    if (local) return setProblem(local);
    const created = await onCreate(name ?? '');
    if (typeof created === 'string') return setProblem(created);
    setName(null);
    setProblem('');
    onCreated(created);
  };
  if (name === null) {
    return (
      <Pressable testID="nueva-categoria" onPress={() => setName('')} className="min-h-[56px] flex-row items-center gap-3 rounded-card border border-dashed border-outline/40 px-4">
        <Plus size={20} color={colors.primary} />
        <Text className="text-[15px] font-semibold text-primary">Nueva categoría</Text>
      </Pressable>
    );
  }
  return (
    <View className="gap-1">
      <View className="min-h-[56px] flex-row items-center gap-2 rounded-card border-2 border-primary bg-surface pl-4 pr-1">
        <TextInput testID="nombre-nueva-categoria" autoFocus value={name} onChangeText={setName} onSubmitEditing={() => void create()} placeholder="Nombre de la categoría" placeholderTextColor={colors['on-surface-variant']} maxLength={MAX_CATEGORY_NAME} className="min-w-0 flex-1 text-[15px] text-on-surface" />
        <Pressable testID="crear-categoria" onPress={() => void create()} className="min-h-[48px] justify-center rounded-thumb px-4">
          <Text className="text-[15px] font-bold text-primary">Crear</Text>
        </Pressable>
      </View>
      {problem ? <Text className="px-1 text-[13px] text-error">{problem}</Text> : null}
    </View>
  );
}
