import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { SEARCHABLE_FROM, filterChoiceOptions, matchSpan, showsInitials, type ChoiceOption, type FormField } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { inicialesDe } from '../../ui/avatarMotor';

type Choice = Extract<FormField, { kind: 'choice' }>;
const ROW_HEIGHT = 60;
/** The sheet leaves this much of the screen to its backdrop. */
const SHEET_MAX_SHARE = '85%';

/**
 * A long list (the company's people to mark attendance, agentes 24/10;
 * design e-35): a field with the one picked, and a sheet with a search that
 * ignores accents and capitals. The web's `SearchableChoice` is its twin.
 */
export function SearchableChoice(props: { field: Choice; value: unknown; onChange: (value: unknown) => void }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const picked = props.field.options.find((option) => option.value === props.value);
  return (
    <>
      <Pressable testID={`campo-${props.field.name}`} accessibilityRole="button" accessibilityLabel={picked ? `${props.field.label}: ${picked.label}` : props.field.label} onPress={() => setOpen(true)} className={`min-h-[52px] flex-row items-center gap-3 rounded-xl border px-3 ${picked ? 'border-primary bg-primary/[0.06]' : 'border-outline/25 bg-background'}`}>
        {picked ? (showsInitials(props.field) ? <Initials label={picked.label} /> : null) : <Search size={18} color={colors['on-surface-variant']} />}
        <View className="min-w-0 flex-1">
          <Text numberOfLines={picked?.sub ? 1 : 2} className={`text-[16px] ${picked ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>{picked ? picked.label : 'Elige de la lista'}</Text>
          {picked?.sub ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{picked.sub}</Text> : null}
        </View>
        <ChevronDown size={18} color={colors['on-surface-variant']} />
      </Pressable>
      {open ? <ChoiceSheet field={props.field} value={props.value} onPick={(value) => { props.onChange(value); setOpen(false); }} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ChoiceSheet(props: { field: Choice; value: unknown; onPick: (value: string) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterChoiceOptions(props.field.options, query), [props.field.options, query]);
  // A search box over three rows is noise, and the keyboard it raises hides them (José, 24/10: carriers and quarries are dropdowns even when short).
  const withSearch = props.field.options.length > SEARCHABLE_FROM;
  // Initials beside people and clients, not beside «No» or a mix design (E2E 28/10).
  const initials = showsInitials(props.field);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      {/* A long list keeps one height while typing; a short one is as tall as its rows. */}
      <View testID={`hoja-${props.field.name}`} className="rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: margins.pie, ...(withSearch ? { height: SHEET_MAX_SHARE } : { maxHeight: SHEET_MAX_SHARE }) }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="flex-row items-center px-4">
          <Text className="flex-1 text-[20px] font-bold text-on-surface">{props.field.label}</Text>
          <Pressable onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center rounded-full bg-background"><X size={20} color={colors['on-surface-variant']} /></Pressable>
        </View>
        {withSearch ? (
          <>
            <View className="mx-4 mt-3 min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/25 bg-background px-3">
              <Search size={18} color={colors['on-surface-variant']} />
              <TextInput testID={`buscar-${props.field.name}`} value={query} onChangeText={setQuery} autoFocus placeholder="Busca por nombre" placeholderTextColor={colors['on-surface-variant']} autoCorrect={false} className="flex-1 text-[16px] text-on-surface" />
              {query ? <Pressable onPress={() => setQuery('')} accessibilityLabel="Borrar la búsqueda" className="h-8 w-8 items-center justify-center"><X size={16} color={colors['on-surface-variant']} /></Pressable> : null}
            </View>
            <Text testID={`cuenta-${props.field.name}`} className="px-4 pb-2 pt-3 text-[13px] text-on-surface-variant">{query.trim() ? `${shown.length} de ${props.field.options.length}` : `${props.field.options.length} opciones`}</Text>
          </>
        ) : <View className="h-3" />}
        <FlatList
          style={{ flexShrink: 1 }}
          data={shown}
          keyExtractor={(option) => option.value}
          keyboardShouldPersistTaps="handled"
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          ListEmptyComponent={<Text className="px-4 py-8 text-center text-[15px] text-on-surface-variant">Nada con ese nombre</Text>}
          renderItem={({ item }) => <OptionRow option={item} query={query} picked={item.value === props.value} onPress={() => props.onPick(item.value)} name={props.field.name} initials={initials} />}
        />
      </View>
    </Modal>
  );
}

function OptionRow(props: { option: ChoiceOption; query: string; picked: boolean; name: string; initials: boolean; onPress: () => void }) {
  const colors = useColores();
  const span = matchSpan(props.option.label, props.query);
  const { label } = props.option;
  return (
    <Pressable testID={`opcion-${props.name}-${props.option.value}`} accessibilityRole="radio" accessibilityState={{ checked: props.picked }} onPress={props.onPress} style={{ height: ROW_HEIGHT }} className={`mx-2 flex-row items-center gap-3 rounded-xl px-2 ${props.picked ? 'bg-primary/[0.08]' : ''}`}>
      {props.initials ? <Initials label={label} /> : null}
      <View className="min-w-0 flex-1">
        <Text numberOfLines={props.option.sub ? 1 : 2} className="text-[16px] font-semibold text-on-surface">
          {span ? <>{label.slice(0, span.start)}<Text className="text-primary">{label.slice(span.start, span.end)}</Text>{label.slice(span.end)}</> : label}
        </Text>
        {props.option.sub ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{props.option.sub}</Text> : null}
      </View>
      {props.picked ? <Check size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

function Initials(props: { label: string }) {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
      <Text className="text-[14px] font-semibold text-primary">{inicialesDe(props.label) ?? '·'}</Text>
    </View>
  );
}
