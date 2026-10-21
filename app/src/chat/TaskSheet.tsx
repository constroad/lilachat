import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarClock, Check, Trash2, X } from 'lucide-react-native';
import { CHECKLIST_LIMITS, activeDueChoice, shortPersonName, taskDueLabel, taskDueOptions, type ChecklistItem } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

export type TaskEdit = { text: string; assignee: string | null; dueAt: string | null };
export type ChecklistMember = { id: string; name: string };

/** A date picked by hand is due at the end of that working day. */
const PICKED_DUE_HOUR = 18;

/**
 * A task's sheet (backlog 30, José 21/10; design `k-03-checklist-responsables`):
 * its text, who does it (a member of the chat, or nobody) and for when (quick
 * days, a date of your own, or none). A draft until «Guardar cambios».
 */
export function TaskSheet(props: { item: ChecklistItem | null; members: readonly ChecklistMember[]; canRemove: boolean; onSave: (edit: TaskEdit) => void; onRemove: () => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { item } = props;
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // The sheet lives mounted: each task that opens it starts from its own values.
  useEffect(() => {
    setText(item?.text ?? '');
    setAssignee(item?.assignee ?? null);
    setDueAt(item?.dueAt ?? null);
    setPicking(false);
  }, [item]);
  // «Hoy» depends on the time it opens.
  const options = useMemo(() => (item ? taskDueOptions(new Date()) : []), [item]);
  const active = activeDueChoice(dueAt, options);
  const assigneeName = props.members.find((member) => member.id === assignee)?.name;

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    setPicking(false);
    if (event.type === 'set' && date) setDueAt(new Date(date.getFullYear(), date.getMonth(), date.getDate(), PICKED_DUE_HOUR).toISOString());
  };
  const chip = (key: string, label: string, lit: boolean, onPress: () => void, icon?: 'calendar') => (
    <Pressable key={key} testID={`tarea-${key}`} onPress={onPress} accessibilityState={{ selected: lit }} className={`min-h-[44px] flex-row items-center gap-1.5 rounded-xl border px-4 ${lit ? 'border-primary bg-primary' : 'border-outline/25 bg-surface'}`}>
      {icon ? <CalendarClock size={16} color={lit ? colors['on-primary'] : colors['on-surface-variant']} /> : null}
      <Text className={`text-[15px] ${lit ? 'font-semibold text-on-primary' : 'text-on-surface-variant'}`}>{label}</Text>
      {lit && !icon ? <Check size={16} color={colors['on-primary']} strokeWidth={3} /> : null}
    </Pressable>
  );
  const person = (id: string | null, name: string, avatar: React.ReactNode) => {
    const lit = assignee === id;
    return (
      <Pressable key={id ?? 'nadie'} testID={`responsable-${id ?? 'nadie'}`} onPress={() => setAssignee(id)} accessibilityState={{ selected: lit }} className={`w-[72px] items-center rounded-xl border py-1.5 ${lit ? 'border-primary bg-primary/[0.06]' : 'border-transparent'}`}>
        {avatar}
        <Text numberOfLines={1} className={`mt-1 text-[12px] ${lit ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{name}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={props.onClose}>
      {/* Editing the text opens the keyboard: the sheet rises with it. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      {item ? (
        <View testID="hoja-tarea" className="rounded-t-3xl bg-surface px-5 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
          <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <View className="flex-row items-start gap-3 border-b border-outline/15 pb-3">
            <View className="flex-1">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-primary">Editar tarea</Text>
              <TextInput testID="tarea-texto" value={text} onChangeText={setText} maxLength={CHECKLIST_LIMITS.item} multiline accessibilityLabel="Texto de la tarea" className="mt-0.5 rounded-lg bg-primary/[0.05] px-2 py-1.5 text-[17px] font-bold text-on-surface" />
            </View>
            <Pressable testID="tarea-cerrar" onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center">
              <X size={20} color={colors['on-surface-variant']} />
            </Pressable>
          </View>
          <View className="flex-row items-center justify-between pb-2 pt-3">
            <Text className="text-[13px] font-bold uppercase tracking-wide text-on-surface">Responsable</Text>
            {assigneeName ? <Text className="text-[13px] font-semibold text-primary">{`Asignado: ${assigneeName}`}</Text> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
            {props.members.map((member) => person(member.id, shortPersonName(member.name), <Avatar nombre={member.name} tamano={44} />))}
            {person(null, 'Nadie', (
              <View className="h-11 w-11 items-center justify-center rounded-full border border-outline/25">
                <X size={18} color={colors['on-surface-variant']} />
              </View>
            ))}
          </ScrollView>
          <Text className="border-t border-outline/15 pb-2 pt-3 text-[13px] font-bold uppercase tracking-wide text-on-surface">Para cuándo</Text>
          <View className="flex-row flex-wrap gap-2 pb-4">
            {options.map((option) => chip(option.id, option.label, active === option.id, () => setDueAt(option.date.toISOString())))}
            {chip('elegir-fecha', active === 'custom' && dueAt ? taskDueLabel(dueAt, new Date()) : 'Elegir fecha', active === 'custom', () => setPicking(true), 'calendar')}
            {chip('sin-fecha', 'Sin fecha', active === 'none', () => setDueAt(null))}
          </View>
          <View className="gap-2.5 border-t border-outline/15 pt-3">
            <Pressable testID="tarea-guardar" disabled={!text.trim()} onPress={() => { props.onSave({ text: text.trim(), assignee, dueAt }); props.onClose(); }} className="min-h-[48px] items-center justify-center rounded-xl bg-primary">
              <Text className="text-[15px] font-bold text-on-primary">Guardar cambios</Text>
            </Pressable>
            {props.canRemove ? (
              <Pressable testID="tarea-quitar" onPress={() => { props.onRemove(); props.onClose(); }} className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-error/40 bg-error/[0.06]">
                <Trash2 size={18} color={colors.error} />
                <Text className="text-[15px] font-semibold text-error">Quitar la tarea</Text>
              </Pressable>
            ) : null}
          </View>
          {picking ? <DateTimePicker value={dueAt ? new Date(dueAt) : new Date()} mode="date" minimumDate={new Date()} onChange={onPicked} /> : null}
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}
