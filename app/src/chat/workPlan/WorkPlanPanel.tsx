import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react-native';
import type { StageStatus, StageSummary, WorkPlanSummary } from '@lilachat/shared';
import { ChecklistEnElChat } from '../ChecklistEnElChat';
import type { ChecklistMember } from '../TaskSheet';
import { useColores } from '../../ui/tema';
import type { WorkPlan } from './useWorkPlan';
import type { OpenTask } from './TaskDetailSheet';

const STATUS_LABEL: Record<StageStatus, string> = { done: 'HECHO', in_progress: 'EN PROCESO', pending: 'PENDIENTE' };

type Props = { plan: WorkPlan; jwt: string; yo: string; nameOf: (userId: string) => string; members: readonly ChecklistMember[]; onStartFailed: (message: string) => void; onOpenTask: (task: OpenTask) => void };

/** The «Checklist» tab of a channel (design e2-17): the plan at a glance and its stages, each one opening its tasks. */
export function WorkPlanPanel(props: Props) {
  const { plan } = props;
  const [open, setOpen] = useState<string | null>(null);
  if (plan.stages === null) return <View className="flex-1 items-center justify-center">{plan.failed ? <Text className="text-on-surface-variant">No se pudo cargar el checklist.</Text> : <ActivityIndicator />}</View>;
  if (plan.stages.length === 0) return <EmptyPlan starting={plan.starting} onStart={() => void plan.start().then((message) => message && props.onStartFailed(message))} />;
  const summary = plan.summary!;
  const expanded = open ?? summary.current?.id ?? null;
  return (
    <ScrollView testID="checklist-de-obra" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <SummaryCard summary={summary} />
      <View className="mt-2 flex-row items-end justify-between">
        <View>
          <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Checklist por etapas</Text>
          <Text className="text-[18px] font-bold text-on-surface">Flujo técnico y control</Text>
        </View>
        <Text className="text-[12px] text-on-surface-variant">Toca para ver</Text>
      </View>
      {summary.stages.map((stage) => (
        <View key={stage.id} className={`overflow-hidden rounded-2xl border bg-surface ${expanded === stage.id ? 'border-primary/50' : 'border-outline/15'}`}>
          <StageRow stage={stage} open={expanded === stage.id} onPress={() => setOpen(expanded === stage.id ? '' : stage.id)} />
          {expanded === stage.id ? (
            <View className="px-2 pb-2">
              <ChecklistEnElChat checklistId={stage.id} jwt={props.jwt} yo={props.yo} nameOf={props.nameOf} members={props.members} onOpenTask={(item) => props.onOpenTask({ stageId: stage.id, itemId: item.id })} />
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function SummaryCard({ summary }: { summary: WorkPlanSummary }) {
  const cells = [
    { label: 'Etapa actual', value: summary.current?.title ?? 'Terminada', hint: summary.current ? `ETAPA ${summary.current.stage}` : '', tone: 'text-on-surface' },
    { label: 'Avance', value: `${summary.percent}%`, hint: `${summary.done} de ${summary.total} ítems`, tone: 'text-on-surface' },
    { label: 'Pendientes', value: String(summary.pending), hint: 'en curso', tone: 'text-warning' },
    { label: 'Vencidos', value: String(summary.overdue), hint: summary.overdue ? '¡Acción!' : 'al día', tone: summary.overdue ? 'text-error' : 'text-on-surface' },
  ];
  return (
    <View testID="resumen-de-obra" className="flex-row rounded-2xl border border-outline/15 bg-surface py-3">
      {cells.map((cell, index) => (
        <View key={cell.label} className={`flex-1 items-center px-1 ${index > 0 ? 'border-l border-outline/10' : ''}`}>
          <Text className="text-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{cell.label}</Text>
          <Text className={`mt-1 text-center font-bold ${index === 0 ? 'text-[14px]' : 'text-[20px]'} ${cell.tone}`} numberOfLines={2}>{cell.value}</Text>
          {cell.hint ? <Text className="text-center text-[11px] text-on-surface-variant">{cell.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function StageRow({ stage, open, onPress }: { stage: StageSummary; open: boolean; onPress: () => void }) {
  const colors = useColores();
  const done = stage.status === 'done';
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <Pressable testID={`etapa-${stage.stage}`} onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} className="px-4 pb-3 pt-3">
      <View className="flex-row items-center gap-3">
        <View className={`h-9 w-9 items-center justify-center rounded-full ${done ? 'bg-en-linea/15' : open ? 'bg-primary' : 'bg-primary/10'}`}>
          {done ? <Check size={18} color={colors['en-linea']} /> : <Text className={`text-[14px] font-bold ${open ? 'text-on-primary' : 'text-primary'}`}>{stage.stage}</Text>}
        </View>
        <View className="flex-1">
          <Text className="text-[16px] font-bold text-on-surface">{`${stage.stage}. ${stage.title}`}</Text>
          <Text className="text-[13px] text-on-surface-variant">{stage.total ? `${stage.done} de ${stage.total} ítems completados` : 'Sin tareas todavía'}</Text>
        </View>
        <Text className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${done ? 'border-en-linea/30 bg-en-linea/10 text-en-linea' : 'border-outline/20 text-on-surface-variant'}`}>{STATUS_LABEL[stage.status]}</Text>
        <Chevron size={18} color={colors['on-surface-variant']} />
      </View>
      <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10">
        <View className={`h-full rounded-full ${done ? 'bg-en-linea' : 'bg-primary'}`} style={{ width: `${stage.total ? (stage.done / stage.total) * 100 : 0}%` }} />
      </View>
    </Pressable>
  );
}

function EmptyPlan(props: { starting: boolean; onStart: () => void }) {
  const colors = useColores();
  return (
    <View testID="checklist-de-obra-vacio" className="flex-1 items-center justify-center px-8">
      <ClipboardList size={40} color={colors.primary} />
      <Text className="mt-3 text-center text-[18px] font-bold text-on-surface">Maneja la obra por etapas</Text>
      <Text className="mt-1 text-center text-[14px] text-on-surface-variant">Cotización, orden de compra, ejecución, valorizaciones, pagos, informes y observaciones. Cada etapa con sus tareas, responsable y fecha.</Text>
      <Pressable testID="btn-armar-checklist-de-obra" disabled={props.starting} onPress={props.onStart} className="mt-5 min-h-[48px] flex-row items-center justify-center rounded-2xl bg-primary px-6">
        {props.starting ? <ActivityIndicator color={colors['on-primary']} /> : <Text className="text-[16px] font-semibold text-on-primary">Armar el checklist de la obra</Text>}
      </Pressable>
    </View>
  );
}
