import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react-native';
import { type ManualPhotoUpload, metersLabel, scopeDraftFor, sendWorkScopeDelete, streetDetailOf, workScopeDeleteRequest, type MapEditSend, type ScopeDraft, type StreetDetail, type StreetLayer, type StreetScopeRow, type WorkMap } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { KICKER } from './WorkMapPanel';
import { ManualProgress, type PhotoAsset } from './ManualProgress';
import { ScopeForm } from './ScopeForm';

function LayerRow({ layer }: { layer: StreetLayer }) {
  return (
    <View testID={`calle-capa-${layer.workId}`} className="flex-row items-center gap-3">
      <Text numberOfLines={1} className="w-24 text-[13px] font-semibold text-on-surface">{layer.name}</Text>
      <View className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-variant"><View className="h-full" style={{ width: `${layer.percent}%`, backgroundColor: layer.color }} /></View>
      <Text className="font-mono text-[12px] text-on-surface-variant">{metersLabel(layer.doneM)}</Text>
    </View>
  );
}

function DeleteAsk(props: { row: StreetScopeRow; send: MapEditSend; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    const result = await props.send(workScopeDeleteRequest(props.row.id), sendWorkScopeDelete);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <View className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3">
      <Text className="text-[15px] font-bold text-on-surface">¿Borrar {props.row.title} ({props.row.range})?</Text>
      <Text className="mt-1 text-[13px] text-on-surface-variant">Un admin puede restaurarlo. Un tramo con avance aprobado no se borra.</Text>
      {error ? <Text className="mt-2 text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="mt-3 flex-row gap-2">
        <Pressable disabled={busy} onPress={props.onCancel} className="h-11 flex-1 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[14px] font-semibold text-on-surface">Cancelar</Text></Pressable>
        <Pressable testID={`borrar-tramo-si-${props.row.id}`} disabled={busy} onPress={() => void remove()} className={`h-11 flex-1 items-center justify-center rounded-xl bg-error ${busy ? 'opacity-60' : ''}`}><Text className="text-[14px] font-bold text-background">{busy ? 'Borrando…' : 'Borrar'}</Text></Pressable>
      </View>
    </View>
  );
}

function ScopeCard(props: { row: StreetScopeRow; send?: MapEditSend; onEdit: () => void }) {
  const { row } = props;
  const colors = useColores();
  const [asking, setAsking] = useState(false);
  return (
    <View testID={`tramo-${row.id}`} className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-bold text-on-surface">{row.title}: <Text className="font-mono">{row.range}</Text></Text>
          <Text className="mt-0.5 font-mono text-[12px] text-on-surface-variant">{row.summary}</Text>
        </View>
        {row.stageName ? <Text className="rounded-md border border-primary/30 px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary">{row.stageName}</Text> : null}
      </View>
      {row.works.length ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {row.works.map((work) => <View key={work.workId} className="flex-row items-center gap-1.5 rounded-lg border border-outline/15 px-2 py-1"><View className="h-2 w-2 rounded-full" style={{ backgroundColor: work.color }} /><Text className="text-[12px] text-on-surface">{work.name} <Text className="font-mono font-bold">{work.percent} %</Text></Text></View>)}
        </View>
      ) : <Text className="mt-2 text-[13px] text-on-surface-variant">Sin trabajos asignados</Text>}
      {props.send ? (
        <View className="mt-2 flex-row justify-end gap-1">
          <Pressable testID={`editar-tramo-${row.id}`} accessibilityLabel={`Editar ${row.title}`} onPress={props.onEdit} className="h-11 w-11 items-center justify-center rounded-lg"><Pencil size={18} color={colors['on-surface-variant']} /></Pressable>
          <Pressable testID={`borrar-tramo-${row.id}`} accessibilityLabel={`Borrar ${row.title}`} onPress={() => setAsking(true)} className="h-11 w-11 items-center justify-center rounded-lg"><Trash2 size={18} color={colors['on-surface-variant']} /></Pressable>
        </View>
      ) : null}
      {asking && props.send ? <DeleteAsk row={row} send={props.send} onCancel={() => setAsking(false)} /> : null}
    </View>
  );
}

type Editing = { draft: ScopeDraft; scopeId?: string } | null;
const editOf = (row: StreetScopeRow): Editing => ({ scopeId: row.id, draft: { fromM: row.scope.fromM, toM: row.scope.toM, workIds: row.scope.workIds, stageId: row.scope.stageId ?? null, widthM: row.scope.widthM ?? null } });
type BodyProps = { map: WorkMap; detail: StreetDetail; send?: MapEditSend; uploadPhoto?: ManualPhotoUpload<PhotoAsset>; editing: Editing; onEditing: (next: Editing) => void; recording: boolean; onRecording: (next: boolean) => void };

/** «Registrar avance» (o-06), what each work did, and the stretches of the street (o-03). */
function StreetBody(props: BodyProps) {
  const colors = useColores();
  const { detail, send, editing } = props;
  return (
    <>
      {send && !props.recording ? <Pressable testID="avance-manual-abrir" onPress={() => props.onRecording(true)} className="h-14 flex-row items-center justify-center gap-2 rounded-xl bg-primary"><TrendingUp size={20} color={colors['on-primary']} /><Text className="text-[16px] font-semibold text-on-primary">Registrar avance</Text></Pressable> : null}
      {send && props.recording ? <ManualProgress map={props.map} streetId={detail.id} lengthM={detail.lengthM} widthM={detail.widthM ?? undefined} send={send} uploadPhoto={props.uploadPhoto} onDone={() => props.onRecording(false)} /> : null}
      {detail.layers.length ? (
        <View className="gap-2 rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
          <Text className={KICKER}>Avance por trabajo</Text>
          {detail.layers.map((layer) => <LayerRow key={layer.workId} layer={layer} />)}
        </View>
      ) : null}
      <View className="flex-row items-center justify-between">
        <Text className={KICKER}>Tramos definidos ({detail.scopes.length})</Text>
        {send && !editing ? <Pressable testID="tramo-agregar" onPress={() => props.onEditing({ draft: scopeDraftFor(detail.lengthM) })} className="h-11 flex-row items-center gap-1.5 rounded-xl border border-primary/30 px-3"><Plus size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Agregar tramo</Text></Pressable> : null}
      </View>
      {editing && send ? <ScopeForm map={props.map} streetId={detail.id} lengthM={detail.lengthM} initial={editing.draft} scopeId={editing.scopeId} send={send} onDone={() => props.onEditing(null)} /> : null}
      {detail.scopes.map((row) => <ScopeCard key={row.id} row={row} send={send} onEdit={() => props.onEditing(editOf(row))} />)}
      {detail.scopes.length ? null : <Text className="text-[14px] text-on-surface-variant">Esta calle todavía no tiene tramos. Agrega uno para asignarle trabajos y etapa.</Text>}
    </>
  );
}

/** Design o-03 on the phone: a sheet with the street, what each work did on it, and its stretches to add, edit or delete. */
export function StreetScopes(props: { map: WorkMap; streetId: string | null; send?: MapEditSend; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<PhotoAsset>; /** «Registrar avance» from the map opens the form straight away. */ startRecording?: boolean; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const detail = useMemo(() => (props.streetId ? streetDetailOf(props.map, props.streetId) : null), [props.map, props.streetId]);
  const [editing, setEditing] = useState<Editing>(null);
  const [recording, setRecording] = useState(false);
  useEffect(() => { setRecording(Boolean(props.streetId && props.startRecording)); }, [props.streetId, props.startRecording]);
  const close = () => { setEditing(null); setRecording(false); props.onClose(); };
  return (
    <Modal visible={Boolean(props.streetId)} animationType="slide" onRequestClose={() => { if (!editing && !recording) close(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background" testID="calle-detalle">
        <View className="flex-row items-center gap-2 border-b border-outline/15 bg-surface px-4 pb-3" style={{ paddingTop: margins.cabecera + 8 }}>
          <Pressable testID="calle-volver" accessibilityLabel="Volver al mapa" onPress={close} className="h-11 w-11 items-center justify-center rounded-xl"><ArrowLeft size={22} color={colors['on-surface']} /></Pressable>
          <Text numberOfLines={1} className="min-w-0 flex-1 text-[20px] font-bold text-on-surface">{detail?.name ?? 'Calle'}</Text>
          {detail ? <Text className="rounded-lg border border-outline/20 px-2 py-1 font-mono text-[12px] font-semibold text-on-surface">{detail.headline}</Text> : null}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24, gap: 12 }}>
          {detail ? <StreetBody map={props.map} detail={detail} send={props.send} uploadPhoto={props.uploadPhoto} editing={editing} onEditing={setEditing} recording={recording} onRecording={setRecording} /> : <Text className="text-[14px] text-on-surface-variant">Esta calle ya no está en el mapa.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
