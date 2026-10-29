import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { CheckCircle2, FileText, FolderOpen } from 'lucide-react-native';
import { pendingTasks, stageFiles, taskDueLabel, type WorkStage } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import type { OpenTask } from './TaskDetailSheet';

/** «Pendientes» of a job's channel (design e2-17): every open task of the plan, overdue first; a tap opens it. */
export function PendingPanel(props: { stages: readonly WorkStage[]; nameOf: (userId: string) => string; onOpen: (task: OpenTask) => void }) {
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
      <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">{`${pending.length} pendientes`}</Text>
      {pending.map((task, index) => {
        const assignee = task.item.assignee ? props.nameOf(task.item.assignee) : null;
        return (
          <Pressable key={`${task.stageId}-${task.item.id}`} testID={`pendiente-${index}`} onPress={() => props.onOpen({ stageId: task.stageId, itemId: task.item.id })} className={`min-h-[64px] flex-row items-center gap-3 rounded-2xl border bg-surface px-4 py-3 ${task.overdue ? 'border-error/40' : 'border-outline/15'}`}>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={2}>{task.item.text}</Text>
              <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{`Etapa ${task.stage} · ${task.stageTitle}`}</Text>
            </View>
            <View className="items-end gap-1">
              {assignee ? <Avatar nombre={assignee} tamano={24} /> : null}
              {task.item.dueAt ? <Text className={`text-[12px] font-semibold ${task.overdue ? 'text-error' : 'text-on-surface-variant'}`}>{taskDueLabel(task.item.dueAt, now)}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** «Archivos» of a job's channel (design e2-17): the evidence of every task by stage; a tap opens the file's message in the chat. */
export function StageFilesPanel(props: { stages: readonly WorkStage[]; onOpenMessage: (seq: number) => void }) {
  const colors = useColores();
  const files = stageFiles(props.stages);
  if (!files.total) {
    return (
      <View testID="archivos-de-obra-vacio" className="flex-1 items-center justify-center px-8">
        <FolderOpen size={40} color={colors.primary} />
        <Text className="mt-3 text-center text-[17px] font-bold text-on-surface">Sin archivos todavía</Text>
        <Text className="mt-1 text-center text-[14px] text-on-surface-variant">Abre una tarea del checklist y sube su evidencia: fotos, planos o informes.</Text>
      </View>
    );
  }
  return (
    <ScrollView testID="archivos-de-obra" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      {files.groups.map((group) => (
        <View key={group.stageId}>
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{`${group.stage}. ${group.title} · ${group.files.length}`}</Text>
          <View className="flex-row flex-wrap gap-2">
            {group.files.map((file) => (
              <Pressable key={file.seq} testID={`archivo-de-obra-${file.seq}`} onPress={() => props.onOpenMessage(file.seq)} className="w-[31.5%] overflow-hidden rounded-xl border border-outline/15 bg-surface">
                {file.kind === 'file' ? (
                  <View className="h-20 items-center justify-center bg-error/[0.06]"><FileText size={26} color={colors.error} /></View>
                ) : (
                  <Image source={{ uri: file.thumbnailUrl ?? file.url }} style={{ width: '100%', height: 80 }} resizeMode="cover" />
                )}
                <Text className="px-2 py-1.5 text-[11px] text-on-surface-variant" numberOfLines={2}>{file.kind === 'file' ? file.name : file.taskText}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
