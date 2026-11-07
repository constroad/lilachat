import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type * as ImagePicker from 'expo-image-picker';
import { Camera, Check, Crosshair, Minus, Plus, Send } from 'lucide-react-native';
import { addManualPhoto, GPS_UNAVAILABLE, manualEndFromGps, MANUAL_NOTE_MAX, MANUAL_PHOTOS_MAX, MANUAL_STEP_M, manualDraftFor, manualFigures, nudgeManualEnd, pickManualWork, runManualProgress, stationLabel, type ManualPhotoUpload, type ManualProgressDraft, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { takeFieldPhoto } from '../useDriveUpload';
import { readGpsOnce } from './useGpsWalk';
import { KICKER } from './WorkMapPanel';

const CARD = 'gap-2 rounded-xl border-[1.5px] border-outline/15 bg-surface p-4';
const LABEL = 'text-[12px] font-semibold uppercase text-on-surface-variant';
const CHIP = 'h-10 flex-row items-center gap-1.5 rounded-full border px-3';
const STEP = 'h-16 flex-1 items-center justify-center rounded-xl border border-outline/20 bg-surface';
type Answer = { ok: boolean; message: string } | null;
export type PhotoAsset = ImagePicker.ImagePickerAsset;
type Props = { map: WorkMap; streetId: string; lengthM: number; widthM?: number; send: MapEditSend; uploadPhoto?: ManualPhotoUpload<PhotoAsset>; onDone: () => void };

/** Step 3: a photo taken in the field, to the service's Drive; Portal only takes those as evidence. */
function Photos(props: { count: number; uploadPhoto?: ManualPhotoUpload<PhotoAsset>; onPhoto: (mediaId: string) => void }) {
  const colors = useColores();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!props.uploadPhoto) return null;
  const upload = props.uploadPhoto;
  const take = async () => {
    const taken = await takeFieldPhoto();
    if (!taken) return;
    if ('message' in taken) return setError(taken.message);
    setBusy(true);
    setError(null);
    const result = await upload(taken.asset);
    setBusy(false);
    if (result.ok) props.onPhoto(result.mediaId);
    else setError(result.message);
  };
  const full = props.count >= MANUAL_PHOTOS_MAX;
  return (
    <View className={CARD}>
      <Text className={KICKER}>3 · Foto en campo</Text>
      <Text className="text-[13px] text-on-surface-variant">Va al Drive del servicio con su fecha y hora.</Text>
      <Pressable testID="avance-foto" disabled={busy || full} onPress={() => void take()} className={`h-12 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 ${busy || full ? 'opacity-60' : ''}`}>
        <Camera size={18} color={colors.primary} /><Text className="text-[15px] font-semibold text-primary">{busy ? 'Subiendo…' : 'Tomar foto'}</Text>
      </Pressable>
      <Text testID="avance-fotos" className="text-[13px] text-on-surface-variant">{props.count} de {MANUAL_PHOTOS_MAX} fotos</Text>
      {error ? <Text className="text-[13px] font-semibold text-error">{error}</Text> : null}
    </View>
  );
}

/** Step 2: from where the work stopped, up to where it reached today. */
function Reach(props: { draft: ManualProgressDraft; lengthM: number; widthM?: number; locating: boolean; onGps: () => void; onChange: (next: ManualProgressDraft) => void }) {
  const colors = useColores();
  const { draft } = props;
  return (
    <View className={CARD}>
      <Text className={LABEL}>2 · ¿Hasta dónde avanzó?</Text>
      <View className="flex-row">
        <View className="flex-1 border-r border-outline/15 pr-3">
          <Text className={KICKER}>Punto de partida</Text>
          <Text testID="avance-manual-desde" className="font-mono text-[24px] font-bold text-on-surface">{stationLabel(draft.fromM)}</Text>
          <Text className="text-[12px] text-on-surface-variant">Sigue donde quedó</Text>
        </View>
        <View className="flex-1 pl-3">
          <Text className={`${KICKER} text-primary`}>Hasta dónde</Text>
          <TextInput testID="avance-manual-hasta" keyboardType="decimal-pad" value={String(draft.toM)} onChangeText={(text) => props.onChange({ ...draft, toM: Number(text.replace(',', '.')) || 0 })} className="mt-1 h-12 rounded-xl border border-outline/25 bg-background px-3 font-mono text-[20px] font-bold text-primary" />
        </View>
      </View>
      <View className="flex-row gap-2">
        <Pressable testID="avance-manual-menos" onPress={() => props.onChange(nudgeManualEnd(draft, -MANUAL_STEP_M, props.lengthM))} className={STEP}>
          <View className="flex-row items-center gap-1"><Minus size={14} color={colors['on-surface']} /><Text className="font-mono text-[16px] font-bold text-on-surface">{MANUAL_STEP_M} m</Text></View>
          <Text className="text-[11px] text-on-surface-variant">Retroceder</Text>
        </Pressable>
        <Pressable testID="avance-manual-gps" disabled={props.locating} onPress={props.onGps} className={`${STEP} border-primary/30 bg-primary/5 ${props.locating ? 'opacity-60' : ''}`}>
          <Crosshair size={18} color={colors.primary} />
          <Text className="text-[11px] font-semibold text-primary">{props.locating ? 'Ubicando…' : 'Mi GPS'}</Text>
        </Pressable>
        <Pressable testID="avance-manual-mas" onPress={() => props.onChange(nudgeManualEnd(draft, MANUAL_STEP_M, props.lengthM))} className={STEP}>
          <View className="flex-row items-center gap-1"><Plus size={14} color={colors.primary} /><Text className="font-mono text-[16px] font-bold text-primary">{MANUAL_STEP_M} m</Text></View>
          <Text className="text-[11px] text-on-surface-variant">Avanzar</Text>
        </Pressable>
      </View>
      <Text className="rounded-xl bg-background p-3 text-[13px] text-on-surface-variant">Metrado de la jornada: <Text testID="avance-manual-metrado" className="font-mono text-[15px] font-bold text-on-surface">{manualFigures(draft, props.widthM)}</Text></Text>
    </View>
  );
}

/** Design o-06 on the phone: which work, up to where, a photo and send; it waits for an admin's approval. */
export function ManualProgress(props: Props) {
  const colors = useColores();
  const start = useMemo(() => manualDraftFor(props.map, props.streetId), [props.map, props.streetId]);
  const [draft, setDraft] = useState<ManualProgressDraft>(start.draft);
  const [entryId] = useState(() => randomUUID());
  const [answer, setAnswer] = useState<Answer>(null);
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);
  const change = (next: ManualProgressDraft) => { setAnswer(null); setDraft(next); };
  const fromGps = async () => {
    setLocating(true);
    const fix = await readGpsOnce();
    setLocating(false);
    const line = props.map.streets.find((street) => street.id === props.streetId)?.line ?? [];
    const placed = fix ? manualEndFromGps(draft, line, props.lengthM, fix) : { problem: GPS_UNAVAILABLE };
    if ('draft' in placed) change(placed.draft);
    else setAnswer({ ok: false, message: placed.problem });
  };
  const submit = async () => {
    setSending(true);
    setAnswer(await runManualProgress({ map: props.map, streetId: props.streetId, lengthM: props.lengthM, draft, entryId, send: props.send, now: new Date() }));
    setSending(false);
  };
  if (answer?.ok) {
    return (
      <View testID="avance-manual" className={CARD}>
        <View className="flex-row items-start gap-2"><Check size={18} color={colors.primary} /><Text testID="avance-manual-respuesta" className="flex-1 text-[15px] font-semibold text-on-surface">{answer.message}</Text></View>
        <Pressable onPress={props.onDone} className="h-12 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[15px] font-semibold text-on-surface">Listo</Text></Pressable>
      </View>
    );
  }
  return (
    <View testID="avance-manual" className="gap-3">
      <View className={CARD}>
        <Text className={`${KICKER} text-primary`}>Registrar avance</Text>
        <Text className={LABEL}>1 · Trabajo</Text>
        <View className="flex-row flex-wrap gap-2">
          {start.works.map((work) => {
            const on = draft.workId === work.id;
            return <Pressable key={work.id} testID={`avance-manual-trabajo-${work.id}`} accessibilityState={{ selected: on }} onPress={() => change(pickManualWork(props.map, props.streetId, draft, work.id))} className={`${CHIP} ${on ? 'border-primary bg-primary/10' : 'border-outline/20'}`}><View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} /><Text className={`text-[14px] font-semibold ${on ? 'text-primary' : 'text-on-surface'}`}>{work.name}</Text></Pressable>;
          })}
          {start.works.length ? null : <Text className="text-[14px] text-on-surface-variant">Esta calle no tiene trabajos en sus tramos. Agrega un tramo con su trabajo primero.</Text>}
        </View>
      </View>
      <Reach draft={draft} lengthM={props.lengthM} widthM={props.widthM} locating={locating} onGps={() => void fromGps()} onChange={change} />
      <Photos count={draft.photoIds.length} uploadPhoto={props.uploadPhoto} onPhoto={(mediaId) => change(addManualPhoto(draft, mediaId))} />
      <View className={CARD}>
        <Text className={LABEL}>4 · Enviar</Text>
        <TextInput testID="avance-manual-nota" value={draft.note} maxLength={MANUAL_NOTE_MAX} multiline placeholder="Nota (opcional)" onChangeText={(note) => change({ ...draft, note })} className="min-h-[56px] rounded-xl border border-outline/25 bg-background px-3 py-2 text-[15px] text-on-surface" />
        <Text className="text-[13px] text-on-surface-variant">Queda pendiente hasta que un admin lo apruebe.</Text>
        {answer ? <Text testID="avance-manual-error" className="text-[14px] font-semibold text-error">{answer.message}</Text> : null}
        <View className="flex-row gap-2">
          <Pressable onPress={props.onDone} className="h-12 flex-1 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[15px] font-semibold text-on-surface">Cancelar</Text></Pressable>
          <Pressable testID="avance-manual-enviar" disabled={sending} onPress={() => void submit()} className={`h-12 flex-[2] flex-row items-center justify-center gap-2 rounded-xl bg-primary ${sending ? 'opacity-60' : ''}`}><Send size={16} color={colors['on-primary']} /><Text className="text-[15px] font-semibold text-on-primary">{sending ? 'Enviando…' : 'Registrar avance'}</Text></Pressable>
        </View>
      </View>
    </View>
  );
}
