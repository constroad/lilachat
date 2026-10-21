import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Check, ClipboardCheck, EllipsisVertical, Plus } from 'lucide-react-native';
import { CHECKLIST_LIMITS, checklistPermissions, checklistProgress, formatClock, toggleChecklistItem, validateChecklistItem, type AgendaChecklist, type ChecklistItem } from '@lilachat/shared';
import { agendaDelete, agendaGet, agendaPatch, agendaPost } from '../agenda/agendaApi';
import { useTarjetaViva } from './useTarjetaViva';
import { useColores } from '../ui/tema';
import { TaskSheet, type ChecklistMember, type TaskEdit } from './TaskSheet';
import { TaskMeta } from './TaskMeta';
import { ChecklistOptionsSheet, type ChecklistEdit } from './ChecklistOptionsSheet';

/** The last seen of each checklist: the cell is recycled while scrolling (as `EncuestaEnElChat`). `null` = gone. */
const seen = new Map<string, AgendaChecklist | null>();

/**
 * A checklist in the chat, like Telegram's (backlog 8, José 21/10; design
 * `k-01-checklist-en-el-chat`): progress, the tasks with who ticked each and
 * when, and «Agregar tarea». A tick shows at once and goes back if the server
 * refuses it; every change reaches the chat live (`ref.changed`).
 */
export function ChecklistEnElChat(props: { checklistId: string; jwt: string; yo: string; nameOf: (userId: string) => string; members: readonly ChecklistMember[] }) {
  const colors = useColores();
  const { checklistId, jwt } = props;
  const [checklist, setChecklist] = useState<AgendaChecklist | null | undefined>(() => seen.get(checklistId));
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  /** What the options sheet edits: a snapshot, so a live change does not wipe what is being typed. */
  const [options, setOptions] = useState<AgendaChecklist | null>(null);

  const put = useCallback((next: AgendaChecklist | null) => {
    seen.set(checklistId, next);
    setChecklist(next);
  }, [checklistId]);
  const load = useCallback(async () => {
    const response = await agendaGet<{ checklist: AgendaChecklist }>(`/checklists/${checklistId}`, jwt);
    if (response.ok) {
      put(response.data.checklist);
      setFailed(false);
    } else if (response.status === 404) put(null);
    else setFailed(true);
  }, [checklistId, jwt, put]);
  useEffect(() => {
    void load();
  }, [load]);
  useTarjetaViva('checklist', checklistId, load);

  if (checklist === null) return <Text className="px-1 text-[13px] italic text-on-surface-variant">Este checklist ya no está disponible.</Text>;
  if (checklist === undefined) {
    return failed ? (
      <Pressable testID={`checklist-reintentar-${checklistId}`} onPress={() => void load()} className="min-h-[44px] justify-center rounded-2xl border border-outline/15 bg-surface px-4">
        <Text className="text-[13px] text-on-surface-variant">No se pudo cargar el checklist. Toca para reintentar.</Text>
      </Pressable>
    ) : (
      <View className="h-40 rounded-xl bg-surface-variant" />
    );
  }

  const { canMark, canAdd } = checklistPermissions({ me: props.yo, createdBy: checklist.createdBy, othersCanMark: checklist.othersCanMark, othersCanAdd: checklist.othersCanAdd });
  const progress = checklistProgress(checklist.items);
  const toggle = async (itemId: string) => {
    const optimistic = toggleChecklistItem(checklist.items, itemId, props.yo, new Date());
    if (!optimistic.ok) return;
    const before = checklist;
    put({ ...checklist, items: optimistic.items });
    setError('');
    const response = await agendaPost<{ checklist: AgendaChecklist }>(`/checklists/${checklistId}/items/${itemId}/toggle`, jwt, {});
    if (response.ok) put(response.data.checklist);
    else {
      put(before);
      setError(response.message ?? 'No se pudo marcar la tarea.');
      if (response.status === 409) void load();
    }
  };
  /** Who does it and for when (backlog 30): shown at once, back if the server refuses. */
  const saveTask = async (itemId: string, edit: TaskEdit) => {
    const before = checklist;
    put({ ...checklist, items: checklist.items.map((item) => (item.id === itemId ? { ...item, ...edit } : item)) });
    setError('');
    const response = await agendaPatch<{ checklist: AgendaChecklist }>(`/checklists/${checklistId}/items/${itemId}`, jwt, edit);
    if (response.ok) put(response.data.checklist);
    else {
      put(before);
      setError(response.message ?? 'No se pudo guardar la tarea.');
    }
  };
  const removeTask = async (itemId: string) => {
    const response = await agendaDelete<{ checklist: AgendaChecklist }>(`/checklists/${checklistId}/items/${itemId}`, jwt);
    if (response.ok) put(response.data.checklist);
    else setError(response.message ?? 'No se pudo quitar la tarea.');
  };
  /** Its author renames it or changes who ticks and adds (José, 21/10). */
  const saveChecklist = async (edit: ChecklistEdit) => {
    const before = checklist;
    put({ ...checklist, ...edit });
    setError('');
    const response = await agendaPatch<{ checklist: AgendaChecklist }>(`/checklists/${checklistId}`, jwt, edit);
    if (response.ok) put(response.data.checklist);
    else {
      put(before);
      setError(response.message ?? 'No se pudo guardar el checklist.');
    }
  };
  const deleteChecklist = async () => {
    const response = await agendaDelete<{ ok: true }>(`/checklists/${checklistId}`, jwt);
    if (response.ok) put(null);
    else setError(response.message ?? 'No se pudo eliminar el checklist.');
  };
  const add = async () => {
    const valid = validateChecklistItem(adding ?? '', checklist.items);
    if (!valid.ok) return setError(valid.message);
    const response = await agendaPost<{ checklist: AgendaChecklist }>(`/checklists/${checklistId}/items`, jwt, { text: valid.text });
    if (!response.ok) return setError(response.message ?? 'No se pudo agregar la tarea.');
    put(response.data.checklist);
    setAdding(null);
    setError('');
  };

  return (
    <View testID={`checklist-${checklistId}`} className="w-full rounded-2xl border border-outline/15 bg-surface px-4 pb-2 pt-3">
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <ClipboardCheck size={14} color={colors.primary} />
            <Text className="text-[11px] font-bold uppercase tracking-wider text-primary">Checklist</Text>
          </View>
          <Text className="mt-0.5 text-[16px] font-bold text-on-surface">{checklist.title}</Text>
        </View>
        <View className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5">
          <Text className="text-[12px] font-bold text-primary">{`${progress.done} de ${progress.total} listas`}</Text>
        </View>
        {checklist.createdBy === props.yo ? (
          <Pressable testID="checklist-opciones" accessibilityLabel="Editar o eliminar el checklist" hitSlop={8} onPress={() => setOptions(checklist)} className="-mr-2 -mt-1 h-9 w-8 items-center justify-center">
            <EllipsisVertical size={18} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
      </View>
      <View className="mb-1 mt-2.5 h-1.5 overflow-hidden rounded-full bg-primary/10">
        <View className="h-full rounded-full bg-primary" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
      </View>
      {checklist.items.map((item, index) => (
        // Two targets, never one with two gestures (José, 21/10: «está inestable el editar con el marcar»):
        // only the circle ticks; the text opens the task to edit. No long press here: the card's own selects the message.
        <View key={item.id} testID={`checklist-tarea-${index}`} className={`min-h-[48px] flex-row items-center ${index > 0 ? 'border-t border-outline/10' : ''}`}>
          <Pressable testID={`checklist-marcar-${index}`} disabled={!canMark} onPress={() => void toggle(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(item.doneBy), disabled: !canMark }} accessibilityLabel={item.text} className="-ml-2.5 h-12 w-12 items-center justify-center">
            <View className={`h-6 w-6 items-center justify-center rounded-full ${item.doneBy ? 'bg-primary' : 'border-2 border-outline/40'}`}>
              {item.doneBy ? <Check size={14} color={colors['on-primary']} strokeWidth={3} /> : null}
            </View>
          </Pressable>
          <Pressable testID={`checklist-editar-${index}`} disabled={!canAdd} onPress={() => setEditing(item)} accessibilityHint={canAdd ? 'Edita la tarea, el responsable y la fecha' : undefined} className="flex-1 py-2">
            <Text className={`text-[15px] ${item.doneBy ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{item.text}</Text>
            {item.doneBy && item.doneAt ? (
              <Text className="mt-0.5 text-[12px] text-on-surface-variant">{`Hecha por ${item.doneBy === props.yo ? 'ti' : props.nameOf(item.doneBy)} · ${formatClock(item.doneAt)}`}</Text>
            ) : (
              <TaskMeta item={item} index={index} name={item.assignee ? (item.assignee === props.yo ? 'Tú' : props.nameOf(item.assignee)) : null} showEmpty={canAdd} />
            )}
          </Pressable>
        </View>
      ))}
      {canAdd && checklist.items.length < CHECKLIST_LIMITS.items ? (
        adding === null ? (
          <Pressable testID="checklist-agregar" onPress={() => setAdding('')} className="min-h-[44px] flex-row items-center gap-2 border-t border-outline/10">
            <Plus size={18} color={colors.primary} />
            <Text className="text-[14px] font-semibold text-primary">Agregar tarea</Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-2 border-t border-outline/10 py-2">
            <TextInput testID="checklist-nueva-tarea" autoFocus value={adding} onChangeText={setAdding} onSubmitEditing={() => void add()} maxLength={CHECKLIST_LIMITS.item} returnKeyType="done" placeholder="Nueva tarea" placeholderTextColor={colors['on-surface-variant']} className="min-h-[40px] flex-1 rounded-lg bg-primary/[0.07] px-3 text-[15px] text-on-surface" />
            <Pressable testID="checklist-guardar-tarea" onPress={() => void add()} className="h-10 items-center justify-center rounded-full bg-primary px-4">
              <Text className="text-[13px] font-bold text-on-primary">Agregar</Text>
            </Pressable>
          </View>
        )
      ) : null}
      {error ? <Text className="pb-1 text-[12px] text-error">{error}</Text> : null}
      <ChecklistOptionsSheet checklist={options} onSave={(edit) => void saveChecklist(edit)} onDelete={() => void deleteChecklist()} onClose={() => setOptions(null)} />
      <TaskSheet item={editing} members={props.members} canRemove={checklist.items.length > 1} onSave={(edit) => editing && void saveTask(editing.id, edit)} onRemove={() => editing && void removeTask(editing.id)} onClose={() => setEditing(null)} />
    </View>
  );
}
