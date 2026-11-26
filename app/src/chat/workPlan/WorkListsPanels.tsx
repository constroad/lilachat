import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Camera, CheckCircle2 } from 'lucide-react-native';
import { chatScopeId, pendingTasks, taskActionsFor, taskDueLabel, type PendingTask, type WorkStage } from '@lilachat/shared';
import { attachEvidence, toggleTask } from './evidenceUpload';
import { useColores } from '../../ui/tema';
import { FieldQueueStrip } from '../../spaces/clients/FieldQueueStrip';
import type { OpenTask } from './TaskDetailSheet';

/** Who may tick and photograph a row, and how (José 19/11, design cc-06). */
export type PendingRowAccess = { admin: boolean; yo: string; jwt: string; chatId: string; onChanged: () => void };
type RowAction = 'mark' | 'photo';

/**
 * One open task (José 19/11, design cc-06): the box ticks it and the camera adds its evidence
 * without opening the detail, for whoever may (`taskActionsFor`: a member who is not admin only
 * their own task). The photo goes through the detail's own door (`attachEvidence`, app camera
 * with its stamp; the server shrinks it once).
 */
function PendingRow(props: { task: PendingTask; index: number; now: Date; nameOf: (userId: string) => string; access: PendingRowAccess; onOpen: (task: OpenTask) => void }) {
  const colors = useColores();
  const [busy, setBusy] = useState<RowAction | null>(null);
  const [error, setError] = useState('');
  const { task, access } = props;
  const { canMark } = taskActionsFor({ admin: access.admin, me: access.yo, assignee: task.item.assignee });
  const assignee = task.item.assignee ? props.nameOf(task.item.assignee) : null;
  const run = async (action: RowAction, work: () => Promise<string | null>) => {
    setBusy(action);
    setError('');
    const problem = await work();
    setBusy(null);
    if (problem) setError(problem);
    access.onChanged();
  };
  const ids = { jwt: access.jwt, checklistId: task.stageId, itemId: task.item.id };
  const mark = () => void run('mark', () => toggleTask({ chatId: access.chatId, checklistId: task.stageId, itemId: task.item.id, done: true }));
  const photo = () => void run('photo', () => attachEvidence({ ...ids, chatId: access.chatId, taskText: task.item.text, source: 'camera' }));
  return (
    <View className={`rounded-2xl border border-l-4 border-l-primary bg-surface ${task.overdue ? 'border-error/40' : 'border-outline/15'}`}>
      <View className="min-h-[64px] flex-row items-center gap-2 py-2 pl-2 pr-3">
        {canMark ? (
          <Pressable testID={`pendiente-marcar-${task.item.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: false, disabled: busy !== null }} accessibilityLabel={`Marcar «${task.item.text}» como hecha`} disabled={busy !== null} onPress={mark} className="h-12 w-12 items-center justify-center">
            <View className="h-6 w-6 rounded-md border-2 border-outline/40" />
          </Pressable>
        ) : null}
        <Pressable testID={`pendiente-${props.index}`} onPress={() => props.onOpen({ stageId: task.stageId, itemId: task.item.id })} className={`flex-1 flex-row items-center gap-3 ${canMark ? '' : 'pl-2'}`}>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={2}>{task.item.text}</Text>
            <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{assignee ? `Etapa ${task.stage} · ${assignee}` : `Etapa ${task.stage} · ${task.stageTitle}`}</Text>
          </View>
          {task.item.dueAt ? <Text className={`text-[12px] font-semibold ${task.overdue ? 'text-error' : 'text-on-surface-variant'}`}>{taskDueLabel(task.item.dueAt, props.now)}</Text> : null}
        </Pressable>
        {canMark ? (
          <Pressable testID={`pendiente-camara-${task.item.id}`} accessibilityRole="button" accessibilityLabel={`Subir evidencia de «${task.item.text}»`} disabled={busy !== null} onPress={photo} className="h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/5">
            {busy === 'photo' ? <ActivityIndicator color={colors.primary} /> : <Camera size={22} color={colors.primary} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" className="px-4 pb-2 text-[12px] text-error">{error}</Text> : null}
    </View>
  );
}

/** «Pendientes» of a job's channel (designs e2-17, cc-06): every open task of the plan, overdue first; a tap opens it. */
export function PendingPanel(props: { stages: readonly WorkStage[]; nameOf: (userId: string) => string; access: PendingRowAccess; onOpen: (task: OpenTask) => void }) {
  const colors = useColores();
  const now = new Date();
  const pending = pendingTasks(props.stages, now);
  if (!pending.length) {
    return (
      <View testID="pendientes-de-obra-vacio" className="flex-1 items-center justify-center px-8">
        <CheckCircle2 size={40} color={colors['en-linea']} />
        <Text className="mt-3 text-center text-[17px] font-bold text-on-surface">Nada pendiente</Text>
        <Text className="mt-1 text-center text-[14px] text-on-surface-variant">Las tareas abiertas de todas las etapas aparecen aquí.</Text>
      </View>
    );
  }
  return (
    <ScrollView testID="pendientes-de-obra" contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}>
      <FieldQueueStrip serviceId={chatScopeId(props.access.chatId)} />
      <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">{`${pending.length} pendientes`}</Text>
      {pending.map((task, index) => <PendingRow key={`${task.stageId}-${task.item.id}`} task={task} index={index} now={now} nameOf={props.nameOf} access={props.access} onOpen={props.onOpen} />)}
    </ScrollView>
  );
}
