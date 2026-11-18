import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Merge, Pencil, X } from 'lucide-react-native';
import { MAX_CATEGORY_NAME, type LinkCategory } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { categoryNameProblem } from './linkView';
import type { LinkActionResult } from './useChatLinks';

type Mode = 'menu' | 'rename' | 'merge';
type Props = {
  category: LinkCategory | null;
  categories: readonly LinkCategory[];
  onClose: () => void;
  onRename: (categoryId: string, name: string) => LinkActionResult;
  onMerge: (categoryId: string, into: string | null) => LinkActionResult;
};

/**
 * A long press on a category's chip (José 18/11): «Renombrar» or «Unir con…»
 * another one (or «Sin categoría»), as the desktop design's buttons.
 */
export function CategoryActionsSheet({ category, categories, onClose, onRename, onMerge }: Props) {
  const colors = useColores();
  const [mode, setMode] = useState<Mode>('menu');
  const [problem, setProblem] = useState('');
  useEffect(() => {
    setMode('menu');
    setProblem('');
  }, [category?.id]);
  const finish = async (request: LinkActionResult) => {
    const failure = await request;
    if (failure) setProblem(failure);
    else onClose();
  };
  return (
    <Sheet visible={category !== null} onClose={onClose} keyboard="avoid" dragArea="handle" maxHeight="80%" testID="hoja-categoria">
      <View className="flex-row items-center justify-between px-5 pb-2">
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-bold tracking-widest text-primary">CATEGORÍA</Text>
          <Text numberOfLines={1} className="text-[20px] font-bold text-on-surface">{category?.name}</Text>
        </View>
        <Pressable accessibilityLabel="Cerrar" onPress={onClose} className="h-12 w-12 items-center justify-center">
          <X size={20} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      {category && mode === 'menu' ? (
        <View className="gap-2 px-4">
          <MenuRow testID="renombrar-categoria" label="Renombrar" Icon={Pencil} onPress={() => setMode('rename')} />
          <MenuRow testID="unir-categoria" label="Unir con…" Icon={Merge} onPress={() => setMode('merge')} />
        </View>
      ) : null}
      {category && mode === 'rename' ? <RenameForm category={category} categories={categories} onSave={(name) => void finish(onRename(category.id, name))} onProblem={setProblem} /> : null}
      {category && mode === 'merge' ? <MergeTargets category={category} categories={categories} onPick={(into) => void finish(onMerge(category.id, into))} /> : null}
      {problem ? <Text className="px-5 pt-2 text-[13px] text-error">{problem}</Text> : null}
    </Sheet>
  );
}

function MenuRow({ testID, label, Icon, onPress }: { testID: string; label: string; Icon: typeof Pencil; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={testID} onPress={onPress} className="min-h-[56px] flex-row items-center gap-3 rounded-card border border-outline/20 px-4">
      <Icon size={20} color={colors.primary} />
      <Text className="text-[15px] font-medium text-on-surface">{label}</Text>
    </Pressable>
  );
}

function RenameForm({ category, categories, onSave, onProblem }: { category: LinkCategory; categories: readonly LinkCategory[]; onSave: (name: string) => void; onProblem: (text: string) => void }) {
  const colors = useColores();
  const [name, setName] = useState(category.name);
  const save = () => {
    const local = categoryNameProblem(name, categories, category.id);
    if (local) return onProblem(local);
    onSave(name);
  };
  return (
    <View className="flex-row items-center gap-2 px-4">
      <TextInput testID="nuevo-nombre-categoria" autoFocus value={name} onChangeText={setName} onSubmitEditing={save} maxLength={MAX_CATEGORY_NAME} placeholderTextColor={colors['on-surface-variant']} className="min-h-[56px] min-w-0 flex-1 rounded-card border-2 border-primary bg-surface px-4 text-[15px] text-on-surface" />
      <Pressable testID="guardar-nombre-categoria" onPress={save} className="min-h-[56px] justify-center rounded-card bg-primary px-5">
        <Text className="text-[15px] font-bold text-on-primary">Guardar</Text>
      </Pressable>
    </View>
  );
}

/** Its links go to the one picked; the category disappears. */
function MergeTargets({ category, categories, onPick }: { category: LinkCategory; categories: readonly LinkCategory[]; onPick: (into: string | null) => void }) {
  const targets = [...categories.filter((one) => one.id !== category.id).map((one) => ({ id: one.id as string | null, name: one.name })), { id: null, name: 'Sin categoría' }];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      <Text className="px-1 pb-1 text-[13px] text-on-surface-variant">{`Sus enlaces pasan a la que elijas y «${category.name}» desaparece.`}</Text>
      {targets.map((target) => (
        <Pressable key={target.id ?? 'none'} testID={`unir-con-${target.id ?? 'none'}`} onPress={() => onPick(target.id)} className="min-h-[56px] justify-center rounded-card border border-outline/20 bg-surface px-4">
          <Text className="text-[15px] font-medium text-on-surface">{target.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
