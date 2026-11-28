import { useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Camera, Crosshair, Hand, Map as MapIcon, X } from 'lucide-react-native';
import { GPS_UNAVAILABLE, MANUAL_NOTE_MAX, recordedProgressIdOf, RECORD_ADD_NOTE, RECORD_NOTE_PLACEHOLDER, layerDraftFor, manualEndFromGps, pickManualWork, progressPreviewOf, RECORD_CHANGE, RECORD_PHOTO_AND_SEND, RECORD_SEND, RECORD_TO_ME, RECORD_WHOLE, RECORD_WITHOUT_PHOTO, recordAtPercent, streetPercentOf, recordDropAt, recordHint, recordTitle, recordMapOf, recordProblem, recordSummary, recordWholeStreet, runManualProgress, youAreOn, type GpsStreet, type ManualPhotoUpload, type ManualProgressDraft, type MapEditSend, type StreetEnd, type WorkManualProgressRequest, type WorkMap, type WorkMapPoint, type WorkMapWork } from '@lilachat/shared';
import type { CapturedShot } from '../../../chat/camara/cameraRequests';
import { useColores } from '../../../ui/tema';
import { useDisposicion } from '../../../ui/useDisposicion';
import { useMargenes } from '../../../ui/useMargenes';
import { takeFieldPhoto } from '../useDriveUpload';
import { ServiceScopeContext } from '../serviceScope';
import { enqueueManualProgress, MANUAL_QUEUED } from './manualProgressJobs';
import { readGpsOnce } from './useGpsWalk';
import { WorkMapSurface } from './WorkMapSurface';
import { RecordPercent } from './RecordPercent';

type Answer = { ok: boolean; message: string } | null;
const STREET_ONLY = { workId: null, fromM: 0, toM: 0 };
/** The side panel beside the map on a tablet or a phone turned sideways. */
const SIDE_WIDTH = 380;
/** On a phone the map keeps most of the height (José 28/11): the foot scrolls past this share. */
const FOOT_MAX_SHARE = 0.4;
const OUTLINE_BUTTON = 'h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/25 bg-surface';
/** A chip of the pickers: 44 dp, as the field chips (José 28/11: «los botones son inmensos»). */
const PICKER_CHIP = 'h-11 max-w-full flex-row items-center gap-2 rounded-xl';

/** The record made: its id when Portal answered it (not when it went to the phone's queue), and whether a photo went with it. */
export type RecordAnswer = { ok: true; message: string; progressId: string | null; withPhoto: boolean };
export type RecordScreenProps = { map: WorkMap; streetId: string; send: MapEditSend; uploadPhoto?: ManualPhotoUpload<CapturedShot>; initial?: ManualProgressDraft; /** The layer picked on opening (ma01), when the street carries it. */ workId?: string | null; located: GpsStreet | null; onChangeStreet: () => void; onClose: () => void; onAnswer: (answer: RecordAnswer) => void };

/** The work (one chip per work the street carries) and the street with «Cambiar» (design ma04). */
function Pickers(props: { works: WorkMapWork[]; workId: string | null; streetName: string; onWork: (workId: string) => void; onChangeStreet: () => void }) {
  return (
    // Wrapped, not a horizontal scroll: a ScrollView grows by default and left the map 0 high (José 28/11).
    <View testID="avance-selectores" className="flex-row flex-wrap gap-2 px-3 py-2">
      {props.works.map((work) => {
        const on = work.id === props.workId;
        return (
          <Pressable key={work.id} testID={`avance-manual-trabajo-${work.id}`} accessibilityState={{ selected: on }} onPress={() => props.onWork(work.id)} className={`${PICKER_CHIP} border-[1.5px] px-3 ${on ? 'border-primary bg-primary/10' : 'border-outline/20 bg-surface'}`}>
            {/* Ringed: a near-black layer (#111827) still shows its dot on the dark theme. */}
            <View className="h-3.5 w-3.5 rounded-sm border border-outline/60" style={{ backgroundColor: work.color }} />
            <Text numberOfLines={1} className={`shrink text-[15px] font-bold ${on ? 'text-primary' : 'text-on-surface'}`}>{work.name}</Text>
          </Pressable>
        );
      })}
      <View className={`${PICKER_CHIP} border border-outline/20 bg-surface-variant pl-3`}>
        <View className="h-2.5 w-2.5 rounded-full bg-en-linea" />
        <Text numberOfLines={1} testID="avance-calle-nombre" className="shrink text-[15px] font-semibold text-on-surface">{props.streetName}</Text>
        <Pressable testID="avance-cambiar-calle" onPress={props.onChangeStreet} className="h-11 shrink-0 justify-center px-3"><Text className="text-[14px] font-bold text-primary underline">{RECORD_CHANGE}</Text></Pressable>
      </View>
    </View>
  );
}

/** «AVANCE: +46 m», «0+120 → 0+166», the bar and «Metrado 276 m²» (design ma04). */
function Summary(props: { draft: ManualProgressDraft; lengthM: number; widthM?: number }) {
  const summary = recordSummary(props.draft, props.lengthM, props.widthM);
  return (
    <View className="gap-1.5">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-[13px] font-bold uppercase text-on-surface-variant">Avance:</Text>
          <Text testID="avance-manual-metrado" className="text-[28px] font-bold text-on-surface">{summary.gain}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[12px] font-bold uppercase text-on-surface-variant">Tramo</Text>
          <Text testID="avance-manual-tramo" className="rounded-lg border border-outline/20 bg-surface-variant px-2 py-0.5 font-mono text-[15px] font-semibold text-on-surface">{summary.stretch}</Text>
        </View>
      </View>
      <View className="h-2 flex-row overflow-hidden rounded-full bg-surface-variant">
        <View className="bg-primary" style={{ width: `${summary.donePct}%` }} />
        <View className="bg-warning" style={{ width: `${summary.newPct}%` }} />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[14px] text-on-surface-variant">{summary.area ? <Text testID="avance-manual-area" className="font-bold text-on-surface">Metrado {summary.area}</Text> : null}{summary.areaHow ? ` · ${summary.areaHow}` : ''}</Text>
        <Text className="font-mono text-[13px] text-on-surface-variant">{summary.total}</Text>
      </View>
    </View>
  );
}

/** The phone's queue when inside a service (José 26/11): the progress and its photo go with or without signal. */
function useQueuedSend(note: string): ((shots: CapturedShot[]) => MapEditSend) | null {
  const scope = useContext(ServiceScopeContext);
  if (!scope) return null;
  return (shots) => async (request) => {
    await enqueueManualProgress(scope, request as WorkManualProgressRequest, note, shots);
    return { ok: true, message: MANUAL_QUEUED };
  };
}

type Evidence = { shots: CapturedShot[]; photoIds: string[] };
const NO_EVIDENCE: Evidence = { shots: [], photoIds: [] };

/** The field photo: kept for the queue, or uploaded to the service's Drive first; null when the camera was closed. */
async function evidenceOf(upload: ManualPhotoUpload<CapturedShot> | undefined): Promise<Evidence | { message: string } | null> {
  const taken = await takeFieldPhoto();
  if (!taken || 'message' in taken) return taken;
  if (!upload) return { shots: [taken.shot], photoIds: [] };
  const uploaded = await upload(taken.shot);
  return uploaded.ok ? { shots: [], photoIds: [uploaded.mediaId] } : { message: uploaded.message };
}

/** One street: the ring from where the work stopped, the summary and «Tomar foto y registrar». */
function useRecord(props: RecordScreenProps) {
  const street = props.map.streets.find((one) => one.id === props.streetId);
  const lengthM = street?.lengthM ?? 0;
  const start = useMemo(() => layerDraftFor(props.map, props.streetId, props.workId ?? null), [props.map, props.streetId, props.workId]);
  const [draft, setDraft] = useState<ManualProgressDraft>(props.initial ?? start.draft);
  const [drops, setDrops] = useState(0);
  const [entryId] = useState(() => randomUUID());
  const [answer, setAnswer] = useState<Answer>(null);
  const [busy, setBusy] = useState<'gps' | 'send' | null>(null);
  const queued = useQueuedSend(draft.note);
  const change = (next: ManualProgressDraft) => { setAnswer(null); setDraft(next); };
  const drop = (_end: StreetEnd, point: WorkMapPoint) => { setDrops((count) => count + 1); change(recordDropAt(draft, street?.line ?? [], lengthM, point)); };
  const toMe = async () => {
    setBusy('gps');
    const fix = await readGpsOnce();
    setBusy(null);
    const placed = fix ? manualEndFromGps(draft, street?.line ?? [], lengthM, fix) : { problem: GPS_UNAVAILABLE };
    if ('draft' in placed) { setDrops((count) => count + 1); change(placed.draft); } else setAnswer({ ok: false, message: placed.problem });
  };
  const send = async (evidence: Evidence) => {
    const via = queued ? queued(evidence.shots) : props.send;
    const sent = await runManualProgress({ map: props.map, streetId: props.streetId, lengthM, draft: { ...draft, photoIds: [...draft.photoIds, ...evidence.photoIds] }, entryId, send: via, now: new Date() });
    if (sent.ok) props.onAnswer({ ok: true, message: sent.message, progressId: recordedProgressIdOf(sent), withPhoto: draft.photoIds.length + evidence.photoIds.length + evidence.shots.length > 0 });
    else setAnswer(sent);
  };
  const submit = async (withPhoto: boolean) => {
    const problem = recordProblem(props.map, props.streetId, lengthM, draft);
    if (problem) return setAnswer({ ok: false, message: problem });
    setBusy('send');
    const evidence = withPhoto ? await evidenceOf(queued ? undefined : props.uploadPhoto) : NO_EVIDENCE;
    if (evidence && 'message' in evidence) setAnswer({ ok: false, message: evidence.message });
    else if (evidence) await send(evidence);
    return setBusy(null);
  };
  const toPercent = (percent: number) => { setDrops((count) => count + 1); change(recordAtPercent(draft, lengthM, percent)); };
  return { street, lengthM, works: start.works, draft, drops, answer, busy, canPhoto: Boolean(queued || props.uploadPhoto), change, drop, toPercent, toMe, submit };
}

/** «Agregar nota» (as o-06 had it): folded so it never pushes the main button down; dictation fits in it. */
function NoteField(props: { note: string; onNote: (note: string) => void }) {
  const [open, setOpen] = useState(props.note.length > 0);
  if (!open) return <Pressable testID="avance-nota-abrir" onPress={() => setOpen(true)} className="h-9 justify-center self-start"><Text className="text-[14px] font-semibold text-primary underline">{RECORD_ADD_NOTE}</Text></Pressable>;
  return <TextInput testID="avance-manual-nota" autoFocus value={props.note} maxLength={MANUAL_NOTE_MAX} multiline placeholder={RECORD_NOTE_PLACEHOLDER} onChangeText={props.onNote} className="min-h-[48px] rounded-xl border border-outline/25 bg-background px-3 py-2 text-[15px] text-on-surface" />;
}

/** The foot: the summary, «Hasta mi ubicación» / «Toda la calle» and the big «Tomar foto y registrar». */
function RecordFoot(props: { record: ReturnType<typeof useRecord>; map: WorkMap; streetId: string }) {
  const colors = useColores();
  const { record } = props;
  const sending = record.busy === 'send';
  return (
    <View className="gap-2">
      <Summary draft={record.draft} lengthM={record.lengthM} widthM={record.street?.widthM} />
      <RecordPercent percent={streetPercentOf(record.draft.toM, record.lengthM)} onPercent={record.toPercent} />
      <NoteField note={record.draft.note} onNote={(note) => record.change({ ...record.draft, note })} />
      <View className="flex-row gap-2">
        <Pressable testID="avance-manual-gps" disabled={record.busy !== null} onPress={() => void record.toMe()} className={`${OUTLINE_BUTTON} ${record.busy === 'gps' ? 'opacity-60' : ''}`}>
          <Crosshair size={18} color={colors.primary} /><Text className="text-[15px] font-semibold text-on-surface">{record.busy === 'gps' ? 'Ubicando…' : RECORD_TO_ME}</Text>
        </Pressable>
        <Pressable testID="avance-toda-la-calle" disabled={record.busy !== null} onPress={() => { record.change(recordWholeStreet(props.map, props.streetId, record.draft, record.lengthM)); }} className={OUTLINE_BUTTON}>
          <MapIcon size={18} color={colors['on-surface']} /><Text className="text-[15px] font-semibold text-on-surface">{RECORD_WHOLE}</Text>
        </Pressable>
      </View>
      {record.answer ? <Text testID="avance-manual-error" accessibilityRole="alert" className="text-[14px] font-semibold text-error">{record.answer.message}</Text> : null}
      <Pressable testID="avance-manual-enviar" disabled={record.busy !== null} onPress={() => void record.submit(record.canPhoto)} className={`h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary ${sending ? 'opacity-60' : ''}`}>
        {record.canPhoto ? <Camera size={20} color={colors['on-primary']} /> : null}
        <Text className="text-[16px] font-bold text-on-primary">{sending ? 'Enviando…' : record.canPhoto ? RECORD_PHOTO_AND_SEND : RECORD_SEND}</Text>
      </Pressable>
      {record.canPhoto ? <Pressable testID="avance-sin-foto" disabled={record.busy !== null} onPress={() => void record.submit(false)} className="h-9 items-center justify-center"><Text className="text-[13px] font-semibold text-on-surface-variant underline">{RECORD_WITHOUT_PHOTO}</Text></Pressable> : null}
    </View>
  );
}

/** Design ma04 on the phone: the map takes the top, the foot the bottom; side by side when the screen is wide. */
export function RecordScreen(props: RecordScreenProps) {
  const colors = useColores();
  const { amplia } = useDisposicion();
  const { height } = useWindowDimensions();
  const record = useRecord(props);
  const margins = useMargenes();
  const shown = useMemo(() => recordMapOf(props.map, props.streetId, record.draft, record.drops), [props.map, props.streetId, record.draft, record.drops]);
  // Framed once per street: the ring moving does not move the camera.
  const view = useMemo(() => progressPreviewOf(props.map, props.streetId, STREET_ONLY).view, [props.map, props.streetId]);
  const workName = record.works.find((work) => work.id === record.draft.workId)?.name;
  return (
    <View testID="avance-manual" className="flex-1">
      {/* The hint lives in the top bar, on the surface token (José 28/11: no light banner on dark). */}
      <View className="flex-row items-center gap-2 border-b border-outline/15 bg-surface px-4 py-1.5">
        <View className="min-w-0 flex-1">
          <Text testID="avance-titulo" numberOfLines={1} className="text-[18px] font-bold text-on-surface">{recordTitle(workName ?? null)}</Text>
          {workName ? <View className="flex-row items-center gap-1.5"><Hand size={14} color={colors.warning} /><Text testID="avance-pista" numberOfLines={1} className="shrink text-[13px] text-on-surface-variant">{recordHint(workName)}</Text></View> : null}
        </View>
        <Pressable testID="avance-cerrar" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full"><X size={22} color={colors['on-surface']} /></Pressable>
      </View>
      <Pickers works={record.works} workId={record.draft.workId} streetName={record.street?.name ?? ''} onWork={(workId) => record.change(pickManualWork(props.map, props.streetId, record.draft, workId))} onChangeStreet={props.onChangeStreet} />
      {/* `padding` on Android too: edge-to-edge does not shrink the window for the keyboard (as PantallaEnModal). The map gives way, the % field stays in sight. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View className={`flex-1 ${amplia ? 'flex-row' : ''}`}>
        <View className="flex-1 overflow-hidden bg-surface-variant">
          <WorkMapSurface view={view} moves stretches={shown.stretch} stations={shown.stations} handles={shown.handles} onHandleDrop={record.drop} />
          {props.located ? <View pointerEvents="none" className="absolute right-3 top-3 rounded-xl border border-outline/20 bg-surface px-3 py-2"><Text testID="avance-ubicado" className="text-[14px] text-on-surface">{youAreOn(props.located)}</Text></View> : null}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={amplia ? { width: SIDE_WIDTH, flexGrow: 0 } : { flexGrow: 0, maxHeight: height * FOOT_MAX_SHARE }} className="rounded-t-3xl bg-surface" contentContainerStyle={{ padding: 12, paddingBottom: 12 + margins.pie }}>
          <RecordFoot record={record} map={props.map} streetId={props.streetId} />
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}
