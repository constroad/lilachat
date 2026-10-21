import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Check, ClipboardCheck, RotateCw } from 'lucide-react-native';
import { myTasks, taskDueLabel, type AgendaChecklist, type MyTask, type MyTaskGroup } from '@lilachat/shared';
import { agendaGet, agendaPost } from './agendaApi';
import { useColores } from '../ui/tema';

const GROUP_TITLE: Record<MyTaskGroup['state'], string> = { overdue: 'Atrasadas', today: 'Hoy', upcoming: 'Próximas', none: 'Sin fecha' };
const PILL: Record<MyTaskGroup['state'], string> = { overdue: 'bg-error/10 text-error font-bold', today: 'bg-primary/10 text-primary font-semibold', upcoming: 'bg-surface-variant text-on-surface-variant', none: '' };

/** «Mis tareas» (backlog 30): what was assigned to me in my chats' checklists; `count` feeds the segment's badge. */
export function useMyTasks(jwt: string, reload: number) {
  const [checklists, setChecklists] = useState<AgendaChecklist[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const response = await agendaGet<{ checklists: AgendaChecklist[] }>('/checklists/mine', jwt);
    if (response.ok) {
      setChecklists(response.data.checklists);
      setFailed(false);
    } else setFailed(true);
  }, [jwt]);
  useEffect(() => {
    void load();
  }, [load, reload]);
  const count = checklists?.reduce((total, checklist) => total + checklist.items.length, 0) ?? 0;
  return { checklists, failed, load, count };
}

/**
 * «Mis tareas» in Pendientes (backlog 30, José 21/10; design
 * `k-04-mis-tareas`): overdue · today · upcoming · no date, each task with
 * its checklist and chat; it is ticked from here, and a tap opens the chat on
 * its checklist.
 */
export function MyTasksView(props: { jwt: string; me: string; tasks: ReturnType<typeof useMyTasks>; chatNameOf: (chatId: string) => string; onOpen: (chatId: string, seq?: number) => void }) {
  const colors = useColores();
  const { checklists, failed, load } = props.tasks;
  const [refreshing, setRefreshing] = useState(false);
  const [ticking, setTicking] = useState<string | null>(null);
  const groups = checklists ? myTasks(checklists, props.me, new Date()) : null;
  const seqOf = (checklistId: string) => checklists?.find((checklist) => checklist._id === checklistId)?.cardSeq;
  const tick = async (task: MyTask) => {
    setTicking(task.item.id);
    await agendaPost(`/checklists/${task.checklistId}/items/${task.item.id}/toggle`, props.jwt, {});
    await load();
    setTicking(null);
  };
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />;

  if (groups === null) {
    return failed ? (
      <Pressable testID="mis-tareas-error" onPress={() => void load()} className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl bg-error/10 px-4 py-3">
        <RotateCw size={16} color={colors.error} />
        <Text className="flex-1 text-[13px] text-error">No se pudieron cargar tus tareas. Toca para reintentar.</Text>
      </Pressable>
    ) : (
      <View className="px-4 pt-4">{[0, 1, 2].map((index) => <View key={index} className="mb-2 h-16 rounded-xl bg-surface-variant" />)}</View>
    );
  }
  if (groups.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} refreshControl={refresh}>
        <View className="flex-1 items-center justify-center px-8" testID="mis-tareas-vacio">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ClipboardCheck size={28} color={colors.primary} />
          </View>
          <Text className="mt-4 text-lg font-semibold text-on-surface">No tienes tareas</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">Cuando alguien te ponga a cargo de una tarea de un checklist, aparece aquí.</Text>
        </View>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 96 }} refreshControl={refresh} testID="mis-tareas">
      {groups.map((group) => (
        <View key={group.state} testID={`tareas-${group.state}`}>
          <Text className={`mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider ${group.state === 'overdue' ? 'text-error' : 'text-primary'}`}>{`${GROUP_TITLE[group.state]} · ${group.tasks.length}`}</Text>
          {group.tasks.map((task) => {
            const seq = seqOf(task.checklistId);
            return (
              <Pressable key={`${task.checklistId}-${task.item.id}`} testID={`mi-tarea-${task.item.id}`} onPress={() => props.onOpen(task.chatId, seq)} className="mb-2 min-h-[64px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface px-3 py-2.5">
                <Pressable testID={`marcar-tarea-${task.item.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: ticking === task.item.id }} accessibilityLabel={`Marcar «${task.item.text}» como hecha`} hitSlop={10} disabled={ticking !== null} onPress={() => void tick(task)} className={`h-6 w-6 items-center justify-center rounded-full ${ticking === task.item.id ? 'bg-primary' : 'border-2 border-outline/40'}`}>
                  {ticking === task.item.id ? <Check size={14} color={colors['on-primary']} strokeWidth={3} /> : null}
                </Pressable>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={2} className="text-[15px] font-semibold text-on-surface">{task.item.text}</Text>
                  <Text numberOfLines={1} className="mt-0.5 text-[12px] text-on-surface-variant">{`${task.checklistTitle} · ${props.chatNameOf(task.chatId)}`}</Text>
                </View>
                {task.item.dueAt ? <Text className={`overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] ${PILL[group.state]}`}>{taskDueLabel(task.item.dueAt, new Date())}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
