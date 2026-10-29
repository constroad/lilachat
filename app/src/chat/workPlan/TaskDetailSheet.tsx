import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarDays, Check, Download, FileText, Plus, RotateCcw, X } from 'lucide-react-native';
import { formatClock, taskActivity, taskDueState, type ChecklistItem, type TaskEvidence, type WorkStage } from '@lilachat/shared';
import { agendaPatch, agendaPost } from '../../agenda/agendaApi';
import { Modal } from '../../ui/Modal';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { TaskSheet, type ChecklistMember, type TaskEdit } from '../TaskSheet';
import { attachEvidence, detachEvidence, type EvidenceSource } from './evidenceUpload';

export type OpenTask = { stageId: string; itemId: string };
type Resolved = { stage: WorkStage; item: ChecklistItem };

const DAY = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
const day = (iso: string) => DAY.format(new Date(iso)).replace(/\./g, '');
const stamp = (iso: string) => `${day(iso)} · ${formatClock(new Date(iso)).replace(/[  ]/g, ' ')}`;
const sizeLabel = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

type Props = {
  open: OpenTask | null;
  stages: readonly WorkStage[];
  channelName: string;
  jwt: string;
  chatId: string;
  yo: string;
  nameOf: (userId: string) => string;
  members: readonly ChecklistMember[];
  onChanged: () => void;
  onOpenMessage: (seq: number) => void;
  onClose: () => void;
};

/**
 * A task of the job (design e2-18): who, for when, its stage, the evidence
 * (photos and files of the channel linked to it), what happened, and
 * «Reasignar» / «Marcar como hecho». Reads the task from the live plan.
 */
export function TaskDetailSheet(props: Props) {
  const colors = useColores();
  const margins = useMargenes();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const stage = props.open ? props.stages.find((one) => one._id === props.open!.stageId) : undefined;
  const item = stage?.items.find((one) => one.id === props.open!.itemId);
  const resolved: Resolved | null = stage && item ? { stage, item } : null;

  const run = async (label: string, action: () => Promise<string | null>) => {
    setBusy(label);
    setError('');
    const problem = await action();
    setBusy(null);
    if (problem) setError(problem);
    props.onChanged();
  };
  const upload = (source: EvidenceSource) => resolved && void run('subir', () => attachEvidence({ jwt: props.jwt, chatId: props.chatId, checklistId: resolved.stage._id, itemId: resolved.item.id, taskText: resolved.item.text, source }));
  const toggle = () => resolved && void run('marcar', async () => {
    const response = await agendaPost(`/checklists/${resolved.stage._id}/items/${resolved.item.id}/toggle`, props.jwt, {});
    return response.ok ? null : (response.message ?? 'No se pudo marcar la tarea.');
  });
  const save = (edit: TaskEdit) => resolved && void run('guardar', async () => {
    const response = await agendaPatch(`/checklists/${resolved.stage._id}/items/${resolved.item.id}`, props.jwt, edit);
    return response.ok ? null : (response.message ?? 'No se pudo guardar la tarea.');
  });
  const askUpload = () => Alert.alert('Subir evidencia', undefined, [{ text: 'Foto', onPress: () => upload('photo') }, { text: 'Documento', onPress: () => upload('file') }, { text: 'Cancelar', style: 'cancel' }]);
  const askRemove = (file: TaskEvidence) => {
    if (!resolved || file.by !== props.yo) return;
    Alert.alert('Quitar de la tarea', 'El archivo sigue en el chat.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Quitar', style: 'destructive', onPress: () => void run('quitar', () => detachEvidence({ jwt: props.jwt, checklistId: resolved.stage._id, itemId: resolved.item.id, seq: file.seq })) }]);
  };

  return (
    <Modal visible={props.open !== null} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      {resolved ? (
        <View testID="hoja-detalle-tarea" className="max-h-[88%] rounded-t-3xl bg-background" style={{ paddingBottom: margins.pie + 8 }}>
          <View className="mb-1 mt-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <Header resolved={resolved} channelName={props.channelName} onClose={props.onClose} />
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Facts resolved={resolved} nameOf={props.nameOf} />
            <Evidence files={resolved.item.evidence ?? []} uploading={busy === 'subir'} onUpload={askUpload} onOpen={(file) => { props.onClose(); props.onOpenMessage(file.seq); }} onRemove={askRemove} />
            <Activity item={resolved.item} nameOf={props.nameOf} />
            {error ? <Text testID="detalle-tarea-error" className="text-[13px] text-error">{error}</Text> : null}
          </ScrollView>
          <View className="flex-row gap-3 border-t border-outline/10 px-4 pt-3">
            <Pressable testID="btn-tarea-reasignar" onPress={() => setEditing(true)} className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-outline/25 bg-surface">
              <Text className="text-[16px] font-semibold text-on-surface">Reasignar</Text>
            </Pressable>
            <ToggleButton done={Boolean(resolved.item.doneBy)} busy={busy === 'marcar'} onPress={toggle} colors={colors} />
          </View>
        </View>
      ) : null}
      <TaskSheet item={editing ? (resolved?.item ?? null) : null} members={props.members} canRemove={false} onSave={(edit) => { setEditing(false); save(edit); }} onRemove={() => setEditing(false)} onClose={() => setEditing(false)} />
    </Modal>
  );
}

function Header({ resolved, channelName, onClose }: { resolved: Resolved; channelName: string; onClose: () => void }) {
  const colors = useColores();
  const state = taskDueState(resolved.item, new Date());
  return (
    <View className="flex-row items-start gap-3 border-b border-outline/10 px-5 pb-3 pt-2">
      <View className="flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-widest text-primary" numberOfLines={1}>{`${resolved.stage.title} · ${channelName}`}</Text>
        <Text testID="detalle-tarea-titulo" className="mt-1 text-[22px] font-bold text-on-surface">{resolved.item.text}</Text>
      </View>
      {state === 'overdue' ? <Pill tone="error" label="VENCIDO" /> : state === 'done' ? <Pill tone="ok" label="HECHO" /> : null}
      <Pressable testID="detalle-tarea-cerrar" onPress={onClose} accessibilityLabel="Cerrar" className="h-10 w-10 items-center justify-center">
        <X size={20} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

function Pill({ tone, label }: { tone: 'error' | 'ok'; label: string }) {
  return <Text className={`mt-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tone === 'error' ? 'border-error/30 bg-error/10 text-error' : 'border-en-linea/30 bg-en-linea/10 text-en-linea'}`}>{label}</Text>;
}

function Facts({ resolved, nameOf }: { resolved: Resolved; nameOf: (userId: string) => string }) {
  const colors = useColores();
  const { item, stage } = resolved;
  const overdue = taskDueState(item, new Date()) === 'overdue';
  const row = (label: string, value: React.ReactNode, first = false) => (
    <View className={`min-h-[52px] flex-row items-center justify-between px-4 ${first ? '' : 'border-t border-outline/10'}`}>
      <Text className="text-[14px] text-on-surface-variant">{label}</Text>
      {value}
    </View>
  );
  const assignee = item.assignee ? nameOf(item.assignee) : null;
  return (
    <View className="rounded-2xl border border-outline/15 bg-surface">
      {row('Responsable', assignee ? <View className="flex-row items-center gap-2"><Avatar nombre={assignee} tamano={26} /><Text className="text-[15px] font-semibold text-on-surface">{assignee}</Text></View> : <Text className="text-[15px] text-on-surface-variant">Sin responsable</Text>, true)}
      {row('Fecha límite', item.dueAt ? <View className="flex-row items-center gap-1.5"><CalendarDays size={16} color={overdue ? colors.error : colors['on-surface-variant']} /><Text className={`text-[15px] font-semibold ${overdue ? 'text-error' : 'text-on-surface'}`}>{`${day(item.dueAt)}${overdue ? ' (Venció)' : ''}`}</Text></View> : <Text className="text-[15px] text-on-surface-variant">Sin fecha</Text>)}
      {row('Etapa', <View className="flex-row items-center gap-2"><Text className="rounded-md border border-outline/20 px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">{`ETAPA ${stage.stage}`}</Text><Text className="text-[15px] font-semibold text-on-surface">{stage.title}</Text></View>)}
    </View>
  );
}

function Evidence(props: { files: readonly TaskEvidence[]; uploading: boolean; onUpload: () => void; onOpen: (file: TaskEvidence) => void; onRemove: (file: TaskEvidence) => void }) {
  const colors = useColores();
  const photos = props.files.filter((file) => file.kind !== 'file');
  const documents = props.files.filter((file) => file.kind === 'file');
  return (
    <View testID="detalle-tarea-evidencia" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Evidencia</Text>
        <Pressable testID="btn-subir-evidencia" disabled={props.uploading} onPress={props.onUpload} className="min-h-[36px] flex-row items-center gap-1 px-1">
          {props.uploading ? <ActivityIndicator size="small" /> : <Plus size={14} color={colors.primary} />}
          <Text className="text-[13px] font-semibold text-primary">{props.uploading ? 'Subiendo…' : 'Subir archivo'}</Text>
        </Pressable>
      </View>
      {props.files.length === 0 ? <Text className="mt-2 text-[13px] text-on-surface-variant">Sin archivos todavía. Sube una foto o un documento que pruebe la tarea.</Text> : null}
      {photos.length ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {photos.map((file, index) => (
            <Pressable key={file.seq} testID={`evidencia-foto-${index}`} onPress={() => props.onOpen(file)} onLongPress={() => props.onRemove(file)} className="w-[48%] overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.06]">
              <Image source={{ uri: file.thumbnailUrl ?? file.url }} style={{ width: '100%', height: 96 }} resizeMode="cover" />
              <View className="px-2.5 py-2">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-primary">{`Foto ${String(index + 1).padStart(2, '0')}`}</Text>
                <Text className="text-[11px] text-on-surface-variant">{stamp(file.at)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {documents.map((file) => (
        <Pressable key={file.seq} testID={`evidencia-archivo-${file.seq}`} onPress={() => props.onOpen(file)} onLongPress={() => props.onRemove(file)} className="mt-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/15 px-3">
          <FileText size={22} color={colors.error} />
          <View className="flex-1">
            <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>{file.name}</Text>
            <Text className="text-[11px] text-on-surface-variant">{`${sizeLabel(file.sizeBytes)} · ${stamp(file.at)}`}</Text>
          </View>
          <Download size={18} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

function Activity({ item, nameOf }: { item: ChecklistItem; nameOf: (userId: string) => string }) {
  const lines = taskActivity(item, nameOf);
  if (!lines.length) return null;
  return (
    <View testID="detalle-tarea-actividad" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Actividad</Text>
      {lines.map((line, index) => (
        <View key={index} className="mt-2 flex-row items-center gap-2">
          <View className={`h-1.5 w-1.5 rounded-full ${line.tone === 'done' ? 'bg-en-linea' : 'bg-primary'}`} />
          <Text className="flex-1 text-[14px] text-on-surface">{line.text}{line.at ? <Text className="text-[12px] text-on-surface-variant">{`  ·  ${day(line.at)}`}</Text> : null}</Text>
        </View>
      ))}
    </View>
  );
}

/** A stage lets any member tick (it is made with «los demás pueden marcar»); the server still decides. */
function ToggleButton(props: { done: boolean; busy: boolean; onPress: () => void; colors: ReturnType<typeof useColores> }) {
  const Icon = props.done ? RotateCcw : Check;
  return (
    <Pressable testID="btn-tarea-marcar" disabled={props.busy} onPress={props.onPress} className={`min-h-[52px] flex-[1.3] flex-row items-center justify-center gap-2 rounded-2xl bg-primary`}>
      {props.busy ? <ActivityIndicator color={props.colors['on-primary']} /> : <Icon size={18} color={props.colors['on-primary']} />}
      <Text className="text-[16px] font-semibold text-on-primary">{props.done ? 'Reabrir' : 'Marcar como hecho'}</Text>
    </Pressable>
  );
}

