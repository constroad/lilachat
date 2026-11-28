import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { layerRecordMap, locateRecordStreet, type RecordLocation, progressPreviewOf, RECORD_LOCATING, RECORD_WHICH_STREET, recordStageOf, recordStreetChoices, recordTitle, type ManualPhotoUpload, type ManualProgressDraft, type MapEditSend, type WorkMap } from '@lilachat/shared';
import type { CapturedShot } from '../../../chat/camara/cameraRequests';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { readGpsOnce } from './useGpsWalk';
import { RecordScreen } from './RecordProgress';
import { WorkMapSurface } from './WorkMapSurface';

export type PhotoAsset = CapturedShot;

/** The street in the street's detail (design o-03): what is done on it. */
export function ProgressPreview(props: { map: WorkMap; streetId: string; draft: Pick<ManualProgressDraft, 'workId' | 'fromM' | 'toM'> }) {
  const preview = useMemo(() => progressPreviewOf(props.map, props.streetId, props.draft), [props.map, props.streetId, props.draft]);
  return (
    <View testID="avance-mapa" pointerEvents="none" className="h-[200px] overflow-hidden rounded-xl border-[1.5px] border-outline/15 bg-surface-variant">
      <WorkMapSurface view={preview.view} moves={false} stretches={preview.stretch} stations={preview.stations} />
    </View>
  );
}

/** One GPS read when the screen opens: which worked street the phone is on (design ma04). */
function useLocatedStreet(map: WorkMap): RecordLocation {
  const [located, setLocated] = useState<RecordLocation>(null);
  const latest = useRef(map);
  latest.current = map;
  useEffect(() => { const stop = locateRecordStreet(readGpsOnce, () => latest.current, setLocated); return stop; }, []);
  return located;
}

/** «¿En qué calle?»: the GPS could not tell, or the person tapped «Cambiar». */
function StreetChooser(props: { map: WorkMap; problem: string | null; locating: boolean; onPick: (streetId: string) => void; onClose: () => void }) {
  const colors = useColores();
  const streets = recordStreetChoices(props.map);
  return (
    <ScrollView testID="avance-elegir-calle" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 8 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[22px] font-bold text-on-surface">{RECORD_WHICH_STREET}</Text>
        <Pressable accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full"><X size={22} color={colors['on-surface']} /></Pressable>
      </View>
      {props.locating ? <Text testID="avance-ubicando" className="text-[14px] text-on-surface-variant">{RECORD_LOCATING}</Text> : null}
      {props.problem ? <Text className="text-[14px] text-on-surface-variant">{props.problem}</Text> : null}
      {streets.map((street) => (
        <Pressable key={street.id} testID={`avance-calle-${street.id}`} onPress={() => props.onPick(street.id)} className="min-h-[56px] flex-row items-center justify-between rounded-xl border border-outline/20 bg-surface px-4">
          <Text className="flex-1 text-[16px] font-semibold text-on-surface">{street.name}</Text>
          <ChevronRight size={18} color={colors['on-surface-variant']} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Sent(props: { message: string; onDone: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-1 justify-center gap-4 p-6">
      <View className="flex-row items-start gap-2"><Check size={22} color={colors.primary} /><Text testID="avance-manual-respuesta" className="flex-1 text-[17px] font-semibold text-on-surface">{props.message}</Text></View>
      <Pressable onPress={props.onDone} className="h-12 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[15px] font-semibold text-on-surface">Listo</Text></Pressable>
    </View>
  );
}

/** `streetId`: the street it opens on; null lets the GPS pick it. `initial`: already filled (#253). */
type Props = { map: WorkMap; streetId: string | null; send: MapEditSend; uploadPhoto?: ManualPhotoUpload<PhotoAsset>; initial?: ManualProgressDraft; /** The layer it opens on (ma01 «Registrar avance de <capa>»). */ workId?: string | null; onDone: () => void };

/** «Registrar avance» (design ma04, José 28/11): a full screen over the map; it waits for an admin's approval. */
export function ManualProgress(props: Props) {
  const margins = useMargenes();
  // From a layer (ma01) the GPS and «¿En qué calle?» look only at that layer's streets.
  const layerMap = useMemo(() => layerRecordMap(props.map, props.workId ?? null), [props.map, props.workId]);
  const located = useLocatedStreet(layerMap);
  const [picked, setPicked] = useState<string | null>(props.streetId);
  const [choosing, setChoosing] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const stage = recordStageOf({ picked, located, choosing, sent });
  const body = stage.kind === 'sent' ? <Sent message={stage.message} onDone={props.onDone} />
    : stage.kind === 'record' ? <RecordScreen key={stage.streetId} map={props.map} streetId={stage.streetId} send={props.send} uploadPhoto={props.uploadPhoto} initial={stage.streetId === props.streetId ? props.initial : undefined} located={stage.located} workId={props.workId ?? null} onChangeStreet={() => setChoosing(true)} onClose={props.onDone} onAnswer={(answer) => setSent(answer.message)} />
      : <StreetChooser map={layerMap} problem={stage.problem} locating={stage.locating} onPick={(id) => { setPicked(id); setChoosing(false); }} onClose={props.onDone} />;
  return (
    <Modal visible animationType="slide" onRequestClose={props.onDone}>
      {/* The record screen pads its own foot (system bar), so that room stays inside its scroll. */}
      <View accessibilityLabel={recordTitle(null)} className="flex-1 bg-background" style={{ paddingTop: margins.cabecera, paddingBottom: stage.kind === 'record' ? 0 : margins.pie }}>{body}</View>
    </Modal>
  );
}
