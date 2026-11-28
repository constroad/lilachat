import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Footprints, Pause, Play, Square } from 'lucide-react-native';
import { dragStreetEnd, pickedStreetFrame, type MapFrame, EMPTY_STREET, nudgeStreetEnd, streetDraftHandles, type StreetEnd, handPointsLabel, modeChangeLoss, setDrawMode, streetDraftHint, streetDraftLines, streetDraftPins, streetDraftProblem, tapStreetDraft, undoStreetDraft, walkedDraft, walkHint, walkPositionPins, workMapView, type DrawMode, type PlaceAsk, type StreetDraft, type TapFeatures, type WorkMap, type WorkMapPoint } from '@lilachat/shared';
import { useCurrentLocation } from '../../../chat/location/useCurrentLocation';
import { useColores } from '../../../ui/tema';
import { useDisposicion } from '../../../ui/useDisposicion';
import { useMargenes } from '../../../ui/useMargenes';
import { WorkMapSurface } from './WorkMapSurface';
import type { StreetSend } from './workProgressSender';
import { useGpsWalk } from './useGpsWalk';
import { PlaceSearch } from './PlaceSearch';
import { EditorLegend, EditorTopBar, EndNudges, ModeSwitch, StreetForm, SwitchQuestion, useBandTone } from './WorkStreetEditorParts';

const NO_STREETS: WorkMap = { streets: [], scopes: [], progress: [], works: [], stages: [] };
const NO_PINS: never[] = [];
const GPS_DENIED = 'Lilachat no tiene permiso de ubicación. Actívalo en Ajustes o dibuja la calle de otra forma.';
/** A rotated phone or a tablet: the controls go to a side panel this wide and the map keeps the rest (dp). */
const SIDE_PANEL_WIDTH = 380;

type EditorProps = { open: boolean; title: string; map: WorkMap | null; send: StreetSend; onClose: () => void; onSaved: (message: string) => void; /** «Busca un lugar o pega el enlace» (José 08/11). */ findPlace?: PlaceAsk; /** The service's place (Portal da5382a5): where a map without streets opens. */ start?: WorkMapPoint };

/** «Pausa / Seguir / Terminar» while walking, «Empezar a caminar» before (design o-13). */
function GpsButtons(props: { walk: ReturnType<typeof useGpsWalk> }) {
  const colors = useColores();
  const tone = useBandTone();
  const gps = props.walk;
  if (!gps.walk.walking) {
    return (
      <Pressable testID="editor-gps-empezar" onPress={() => void gps.start()} className={`mt-2 h-12 flex-row items-center justify-center gap-2 rounded-xl ${tone.raised}`}>
        <Footprints size={20} color={colors.primary} /><Text className="text-[16px] font-bold text-primary">Empezar a caminar</Text>
      </Pressable>
    );
  }
  return (
    <View className="mt-2 flex-row gap-2">
      <Pressable testID={gps.walk.paused ? 'editor-gps-seguir' : 'editor-gps-pausa'} onPress={gps.walk.paused ? gps.resume : gps.pause} className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${tone.raised}`}>
        {gps.walk.paused ? <Play size={18} color={colors.primary} /> : <Pause size={18} color={colors.primary} />}
        <Text className="text-[16px] font-bold text-primary">{gps.walk.paused ? 'Seguir' : 'Pausa'}</Text>
      </Pressable>
      <Pressable testID="editor-gps-terminar" onPress={gps.stop} className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${tone.raised}`}>
        <Square size={18} color={colors.primary} /><Text className="text-[16px] font-bold text-primary">Terminar</Text>
      </Pressable>
    </View>
  );
}

/**
 * Design o-02, audited 07/11: tap the street, then where the work starts and ends on it; or draw it by
 * hand. José 27/11: the map is the protagonist. On a phone, a one-line band over it and a form that
 * folds under it; rotated or on a tablet, the band and the form go to a side panel.
 */
export function WorkStreetEditor(props: EditorProps) {
  const [draft, setDraft] = useState<StreetDraft>(EMPTY_STREET);
  const [entryId] = useState(() => randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState<{ mode: DrawMode; question: string } | null>(null);
  const switchTo = (mode: DrawMode) => { setSwitching(null); setError(null); gps.reset(); setDraft((before) => setDrawMode(before, mode)); };
  const view = useMemo(() => workMapView(props.map ?? NO_STREETS), [props.map]);
  const gps = useGpsWalk();
  useEffect(() => { setDraft((before) => (before.mode === 'gps' ? walkedDraft(before, gps.walk) : before)); }, [gps.walk]);
  const { current } = useCurrentLocation(props.open && !view.bounds && !props.start);
  const margins = useMargenes();
  const { amplia } = useDisposicion();
  const change = (next: Partial<StreetDraft>) => {
    setError(null);
    setDraft((before) => ({ ...before, ...next }));
  };
  // Every drop re-keys the rings: a native ring stays where the finger left it otherwise (José 27/11).
  const [drops, setDrops] = useState(0);
  const handles = useMemo(() => streetDraftHandles(draft, drops), [draft, drops]);
  const [focus, setFocus] = useState<WorkMapPoint | null>(null);
  const onHandleDrop = (handle: StreetEnd, point: WorkMapPoint) => {
    const dropped = dragStreetEnd(draft, handle, point);
    setDrops((count) => count + 1);
    setDraft(dropped.draft);
    setError(dropped.problem);
  };
  const [frame, setFrame] = useState<MapFrame | null>(null);
  const onTap = (_point: WorkMapPoint, roads: TapFeatures) => {
    const tapped = tapStreetDraft(draft, roads);
    const picked = pickedStreetFrame(draft, tapped.draft);
    if (picked) setFrame(picked);
    setDraft(tapped.draft);
    setError(tapped.problem);
  };
  const save = async () => {
    const problem = streetDraftProblem(draft);
    if (problem) return setError(problem);
    setSaving(true);
    const sent = await props.send(draft, entryId);
    setSaving(false);
    if (sent.ok) props.onSaved(sent.message);
    else setError(sent.message);
  };
  const tone = useBandTone();
  const undo = () => { setError(null); if (draft.mode === 'gps') gps.undo(); else setDraft(undoStreetDraft); };
  const onMode = (mode: DrawMode) => { const question = modeChangeLoss(draft, mode); if (question) setSwitching({ mode, question }); else switchTo(mode); };
  const band = (
    <View className={`${tone.band} px-4 pb-3`} style={{ paddingTop: margins.cabecera + 4 }}>
      <EditorTopBar kicker={props.title} canUndo={draft.points.length > 0} onUndo={undo} onCancel={props.onClose} />
      {draft.points.length ? null : <PlaceSearch ask={props.findPlace} near={focus ?? props.start} onPick={setFocus} />}
      <ModeSwitch mode={draft.mode} onMode={onMode} />
      {switching ? <SwitchQuestion question={switching.question} onYes={() => switchTo(switching.mode)} onNo={() => setSwitching(null)} /> : null}
      <View className="mt-2 flex-row items-center justify-between gap-2">
        <Text testID="editor-calle-ayuda" className={`flex-1 text-[13px] font-semibold ${tone.text}`}>{draft.mode === 'gps' ? (gps.denied ? GPS_DENIED : walkHint(gps.walk)) : streetDraftHint(draft)}</Text>
        {draft.mode === 'hand' ? <Text testID="editor-calle-puntos" className={`rounded-md ${tone.soft} px-2 py-0.5 font-mono text-[12px] ${tone.text}`}>{handPointsLabel(draft.points.length)}</Text> : null}
      </View>
      {draft.mode === 'gps' ? <GpsButtons walk={gps} /> : null}
    </View>
  );
  const form = <StreetForm draft={draft} stages={props.map?.stages ?? []} error={error} saving={saving} change={change} onSave={() => void save()} foldable={!amplia} />;
  // overflow-hidden: with the keyboard open the map shrinks and its buttons spilled over the header (E2E 12/11).
  const mapArea = (
    <View className="flex-1 overflow-hidden">
      {props.open ? <WorkMapSurface view={view} moves pins={handles.length ? (draft.mode === 'hand' ? streetDraftPins(draft).slice(1, -1) : NO_PINS) : [...streetDraftPins(draft), ...walkPositionPins(gps.walk)]} stretches={streetDraftLines(draft)} onTap={onTap} handles={handles} onHandleDrop={onHandleDrop} focus={focus} frame={frame} near={props.start ?? (current.state === 'ready' ? current.location : null)} /> : null}
      <EditorLegend />
      {handles.length && draft.mode !== 'hand' ? <EndNudges onNudge={(handle, deltaM) => { setError(null); setDraft((before) => nudgeStreetEnd(before, handle, deltaM)); }} /> : null}
    </View>
  );
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={() => { if (!draft.points.length) props.onClose(); }}>
      <KeyboardAvoidingView behavior="padding" className={`flex-1 bg-background ${amplia ? 'flex-row' : ''}`} testID="editor-calle">
        {amplia ? (
          <>
            {mapArea}
            <View testID="editor-calle-panel" className="border-l border-outline/15 bg-surface" style={{ width: SIDE_PANEL_WIDTH }}>
              {band}
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: margins.pie + 12 }}>{form}</ScrollView>
            </View>
          </>
        ) : (
          <>
            {band}
            {mapArea}
            <View className="border-t border-outline/15 bg-surface px-4 pt-2" style={{ paddingBottom: margins.pie + 8 }}>{form}</View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
