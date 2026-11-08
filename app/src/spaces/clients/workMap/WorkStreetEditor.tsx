import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Footprints, Save, Square, Undo2, X } from 'lucide-react-native';
import { DRAW_MODES, EMPTY_STREET, metersLabel, modeChangeLoss, setDrawMode, streetDraftArea, streetDraftEnds, streetDraftHint, streetDraftLengthM, streetDraftLines, streetDraftPins, streetDraftProblem, tapStreetDraft, undoStreetDraft, walkedDraft, walkHint, workMapView, type DrawMode, type StreetDraft, type TapFeatures, type WorkMap, type WorkMapPoint, type WorkMapStage } from '@lilachat/shared';
import { useCurrentLocation } from '../../../chat/location/useCurrentLocation';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { WorkMapSurface } from './WorkMapSurface';
import type { StreetSend } from './workProgressSender';
import { useGpsWalk } from './useGpsWalk';

const NO_STREETS: WorkMap = { streets: [], scopes: [], progress: [], works: [], stages: [] };
const FIELD = 'mt-1 h-12 rounded-xl border border-outline/25 bg-background px-3 text-[15px] text-on-surface';
const LABEL = 'text-[12px] font-semibold uppercase text-on-surface-variant';
const LENGTH_HINT = 'Medido en el mapa';
const GPS_DENIED = 'Lilachat no tiene permiso de ubicación. Actívalo en Ajustes o dibuja la calle de otra forma.';

type EditorProps = { open: boolean; title: string; map: WorkMap | null; send: StreetSend; onClose: () => void; onSaved: (message: string) => void };

/** «Tocar la calle» first: it is the fast one (audit 07/11). «A mano» is for a pasaje the map lacks. */
function ModeSwitch({ mode, onMode }: { mode: DrawMode; onMode: (mode: DrawMode) => void }) {
  return (
    <View accessibilityRole="radiogroup" className="mt-2 flex-row gap-1 rounded-xl bg-on-primary/15 p-1">
      {DRAW_MODES.map((one) => (
        <Pressable key={one.mode} testID={`editor-modo-${one.mode}`} accessibilityRole="radio" accessibilityState={{ checked: mode === one.mode }} onPress={() => onMode(one.mode)} className={`h-10 flex-1 items-center justify-center rounded-lg ${mode === one.mode ? 'bg-surface' : ''}`}>
          <Text className={`text-[14px] font-semibold ${mode === one.mode ? 'text-primary' : 'text-on-primary'}`}>{one.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Design o-02, audited 07/11: tap the street, then where the work starts and ends on it; or draw it by hand. */
/** «Cambiar de forma borra lo que marcaste»: asked before a switch erases a street (audit 08/11). */
function SwitchQuestion(props: { question: string; onYes: () => void; onNo: () => void }) {
  return (
    <View testID="editor-calle-cambiar-modo" className="mt-2 rounded-xl bg-on-primary/15 p-3">
      <Text className="text-[14px] font-semibold text-on-primary">{props.question}</Text>
      <View className="mt-2 flex-row gap-2">
        <Pressable testID="editor-calle-cambiar-si" onPress={props.onYes} className="h-11 flex-1 items-center justify-center rounded-xl bg-surface"><Text className="text-[14px] font-semibold text-primary">Cambiar</Text></Pressable>
        <Pressable testID="editor-calle-cambiar-no" onPress={props.onNo} className="h-11 flex-1 items-center justify-center rounded-xl bg-on-primary/15"><Text className="text-[14px] font-semibold text-on-primary">Seguir aquí</Text></Pressable>
      </View>
    </View>
  );
}

/** The stage chosen with the street (o-02): it rides on a stretch over the whole street. */
function StageField(props: { stages: WorkMapStage[]; stageId?: string; onPick: (stageId?: string) => void }) {
  if (!props.stages.length) return null;
  const options = [{ id: '', name: 'Sin etapa' }, ...props.stages];
  return (
    <View className="mt-3">
      <Text className={LABEL}>Etapa</Text>
      <View className="mt-1 flex-row flex-wrap gap-2">
        {options.map((stage) => {
          const on = (props.stageId ?? '') === stage.id;
          return <Pressable key={stage.id || 'ninguna'} testID={`editor-calle-etapa-${stage.id || 'ninguna'}`} onPress={() => props.onPick(stage.id || undefined)} className={`h-10 justify-center rounded-xl border px-3 ${on ? 'border-primary bg-primary/10' : 'border-outline/25'}`}><Text className={`text-[14px] font-semibold ${on ? 'text-primary' : 'text-on-surface'}`}>{stage.name}</Text></Pressable>;
        })}
      </View>
    </View>
  );
}

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
  const { current } = useCurrentLocation(props.open && !view.bounds);
  const margins = useMargenes();
  const colors = useColores();
  const change = (next: Partial<StreetDraft>) => {
    setError(null);
    setDraft((before) => ({ ...before, ...next }));
  };
  const onTap = (_point: WorkMapPoint, roads: TapFeatures) => {
    const tapped = tapStreetDraft(draft, roads);
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
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={() => { if (!draft.points.length) props.onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background" testID="editor-calle">
        <View className="bg-primary px-4 pb-3" style={{ paddingTop: margins.cabecera + 8 }}>
          <Text className="font-mono text-[11px] font-bold uppercase tracking-[2px] text-on-primary/80" numberOfLines={1}>{props.title}</Text>
          <Text className="text-[20px] font-bold text-on-primary">Definir área de trabajo</Text>
          <ModeSwitch mode={draft.mode} onMode={(mode) => { const question = modeChangeLoss(draft, mode); if (question) setSwitching({ mode, question }); else switchTo(mode); }} />
          {switching ? <SwitchQuestion question={switching.question} onYes={() => switchTo(switching.mode)} onNo={() => setSwitching(null)} /> : null}
          <View className="mt-2 flex-row items-center justify-between gap-2">
            <Text testID="editor-calle-ayuda" className="flex-1 text-[15px] font-semibold text-on-primary">{draft.mode === 'gps' ? (gps.denied ? GPS_DENIED : walkHint(gps.walk)) : streetDraftHint(draft)}</Text>
            {draft.mode === 'hand' ? <Text testID="editor-calle-puntos" className="rounded-md bg-on-primary/15 px-2 py-0.5 font-mono text-[12px] text-on-primary">{draft.points.length} puntos</Text> : null}
          </View>
          {draft.mode === 'gps' ? (
            <Pressable testID={gps.walk.walking ? 'editor-gps-terminar' : 'editor-gps-empezar'} onPress={gps.walk.walking ? gps.stop : () => void gps.start()} className="mt-2 h-14 flex-row items-center justify-center gap-2 rounded-xl bg-surface">
              {gps.walk.walking ? <Square size={18} color={colors.primary} /> : <Footprints size={20} color={colors.primary} />}
              <Text className="text-[16px] font-bold text-primary">{gps.walk.walking ? 'Terminar' : 'Empezar a caminar'}</Text>
            </Pressable>
          ) : null}
          <View className="mt-2 flex-row gap-2">
            <Pressable testID="editor-calle-deshacer" disabled={!draft.points.length} onPress={() => { setError(null); if (draft.mode === 'gps') gps.reset(); setDraft(undoStreetDraft); }} className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-on-primary/15 ${draft.points.length ? '' : 'opacity-50'}`}>
              <Undo2 size={16} color={colors['on-primary']} /><Text className="text-[14px] font-semibold text-on-primary">Deshacer</Text>
            </Pressable>
            <Pressable testID="editor-calle-cancelar" onPress={props.onClose} className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-on-primary/15">
              <X size={16} color={colors['on-primary']} /><Text className="text-[14px] font-semibold text-on-primary">Cancelar</Text>
            </Pressable>
          </View>
        </View>
        <View className="flex-1">
          {props.open ? <WorkMapSurface view={view} moves pins={streetDraftPins(draft)} stretches={streetDraftLines(draft)} onTap={onTap} near={current.state === 'ready' ? current.location : null} /> : null}
        </View>
        <View className="border-t border-outline/15 bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 12 }}>
          <Text className={LABEL}>Nombre</Text>
          <TextInput testID="editor-calle-nombre" value={draft.name} maxLength={80} placeholder="Jr. Los Pinos" onChangeText={(name) => change({ name })} className={FIELD} />
          <View className="mt-3 flex-row gap-3">
            <View className="flex-1">
              <View className="flex-row items-center justify-between"><Text className={LABEL}>Largo</Text><Text className="text-[11px] font-bold text-primary">Auto</Text></View>
              <Text testID="editor-calle-largo" className="mt-1 py-3 font-mono text-[15px] text-on-surface">{metersLabel(streetDraftLengthM(draft))}</Text>
              <Text testID="editor-calle-extremos" className="font-mono text-[11px] text-on-surface-variant">{streetDraftEnds(draft) ?? LENGTH_HINT}</Text>
            </View>
            <View className="flex-1">
              <Text className={LABEL}>Ancho (m)</Text>
              <TextInput testID="editor-calle-ancho" keyboardType="decimal-pad" value={draft.widthM === null ? '' : String(draft.widthM)} placeholder="6.0" onChangeText={(text) => change({ widthM: text.trim() ? Number(text.replace(',', '.')) : null })} className={FIELD} />
            </View>
          </View>
          <StageField stages={props.map?.stages ?? []} stageId={draft.stageId} onPick={(stageId) => change({ stageId })} />
          {streetDraftArea(draft) ? <View className="mt-3 flex-row items-center justify-between rounded-xl border border-outline/15 bg-background px-3 py-2"><Text className="text-[13px] text-on-surface-variant">Área neta</Text><Text testID="editor-calle-area" className="font-mono text-[15px] font-bold text-on-surface">{streetDraftArea(draft)}</Text></View> : null}
          {error ? <Text testID="editor-calle-error" className="mt-2 text-[13px] font-semibold text-error">{error}</Text> : null}
          <Pressable testID="editor-calle-guardar" disabled={saving} onPress={() => void save()} className={`mt-3 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary ${saving ? 'opacity-60' : ''}`}>
            <Save size={18} color={colors['on-primary']} /><Text className="text-[15px] font-semibold text-on-primary">{saving ? 'Guardando…' : 'Guardar calle'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
