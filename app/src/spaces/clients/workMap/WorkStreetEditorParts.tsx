import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, Navigation, Save, Undo2, X } from 'lucide-react-native';
import { DRAW_MODES, metersLabel, streetDraftArea, streetDraftEnds, streetDraftLengthM, WORK_MAP_DRAFT_COLOR, WORK_MAP_PLANNED_COLOR, type DrawMode, type StreetDraft, type StreetEnd, type WorkMapStage } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const FIELD = 'mt-1 h-11 rounded-xl border border-outline/25 bg-background px-3 text-[15px] text-on-surface';
const LABEL = 'text-[11px] font-semibold uppercase text-on-surface-variant';
const LENGTH_HINT = 'Medido en el mapa';
/** One step of «−10 m» / «+10 m»: a finger lands within a few meters, the buttons finish the job. */
const NUDGE_M = 10;
const ICON_BUTTON = 'h-10 w-10 items-center justify-center rounded-xl bg-on-primary/15';

/**
 * José 27/11: «el área del mapa es muy muy pequeña». One line of title with «Deshacer» and «Cancelar»
 * as icons beside it; the band of o-02 kept its words in two full-width buttons.
 */
export function EditorTopBar(props: { kicker: string; canUndo: boolean; onUndo: () => void; onCancel: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1">
        <Text className="font-mono text-[10px] font-bold uppercase tracking-[2px] text-on-primary/80" numberOfLines={1}>{props.kicker}</Text>
        <Text className="text-[17px] font-bold text-on-primary" numberOfLines={1}>Definir área de trabajo</Text>
      </View>
      <Pressable testID="editor-calle-deshacer" accessibilityLabel="Deshacer" disabled={!props.canUndo} onPress={props.onUndo} className={`${ICON_BUTTON} ${props.canUndo ? '' : 'opacity-50'}`}>
        <Undo2 size={18} color={colors['on-primary']} />
      </Pressable>
      <Pressable testID="editor-calle-cancelar" accessibilityLabel="Cancelar" onPress={props.onCancel} className={ICON_BUTTON}>
        <X size={18} color={colors['on-primary']} />
      </Pressable>
    </View>
  );
}

/** «Tocar la calle» first: it is the fast one (audit 07/11). «A mano» is for a pasaje the map lacks. */
export function ModeSwitch({ mode, onMode }: { mode: DrawMode; onMode: (mode: DrawMode) => void }) {
  return (
    <View accessibilityRole="radiogroup" className="mt-2 flex-row gap-1 rounded-xl bg-on-primary/15 p-1">
      {DRAW_MODES.map((one) => (
        <Pressable key={one.mode} testID={`editor-modo-${one.mode}`} accessibilityRole="radio" accessibilityState={{ checked: mode === one.mode }} onPress={() => onMode(one.mode)} className={`h-9 flex-1 items-center justify-center rounded-lg ${mode === one.mode ? 'bg-surface' : ''}`}>
          <Text numberOfLines={1} className={`text-[13px] font-semibold ${mode === one.mode ? 'text-primary' : 'text-on-primary'}`}>{one.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** «Cambiar de forma borra lo que marcaste»: asked before a switch erases a street (audit 08/11). */
export function SwitchQuestion(props: { question: string; onYes: () => void; onNo: () => void }) {
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

/** The stage chosen with the street (o-02): one scrolling row, so it never pushes the map away. */
function StageField(props: { stages: WorkMapStage[]; stageId?: string; onPick: (stageId?: string) => void }) {
  if (!props.stages.length) return null;
  const options = [{ id: '', name: 'Sin etapa' }, ...props.stages];
  return (
    <View className="mt-2 flex-row items-center gap-2">
      <Text className={LABEL}>Etapa</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
        {options.map((stage) => {
          const on = (props.stageId ?? '') === stage.id;
          return <Pressable key={stage.id || 'ninguna'} testID={`editor-calle-etapa-${stage.id || 'ninguna'}`} onPress={() => props.onPick(stage.id || undefined)} className={`h-10 justify-center rounded-xl border px-3 ${on ? 'border-primary bg-primary/10' : 'border-outline/25'}`}><Text className={`text-[14px] font-semibold ${on ? 'text-primary' : 'text-on-surface'}`}>{stage.name}</Text></Pressable>;
        })}
      </ScrollView>
    </View>
  );
}

/** Legend and north over the editor's map (design o-02): what the violet line is, and which way is up. */
export function EditorLegend() {
  const colors = useColores();
  return (
    <>
      <View testID="editor-leyenda" pointerEvents="none" className="absolute bottom-3 left-3 gap-1 rounded-xl border border-outline/15 bg-surface px-3 py-2">
        <View className="flex-row items-center gap-2"><View className="h-1 w-6 rounded-full" style={{ backgroundColor: WORK_MAP_DRAFT_COLOR }} /><Text className="text-[12px] font-semibold text-on-surface">Calle nueva</Text></View>
        <View className="flex-row items-center gap-2"><View className="h-0 w-6 border-t-2 border-dashed" style={{ borderColor: WORK_MAP_PLANNED_COLOR }} /><Text className="text-[12px] font-semibold text-on-surface">Calles de la obra</Text></View>
      </View>
      <View testID="editor-norte" accessibilityLabel="Norte arriba" pointerEvents="none" className="absolute left-3 top-3 h-11 w-11 items-center justify-center rounded-full border border-outline/15 bg-surface">
        <Navigation size={14} color={colors['on-surface']} /><Text className="text-[10px] font-bold text-on-surface">N</Text>
      </View>
    </>
  );
}

/**
 * «Inicio −10 m +10 m · Fin −10 m +10 m» (José 08/11), floating over the top of the map (José 27/11:
 * in the violet band they took a whole row from the map).
 */
export function EndNudges({ onNudge }: { onNudge: (handle: StreetEnd, deltaM: number) => void }) {
  const ends: Array<{ handle: StreetEnd; label: string; key: string }> = [{ handle: 'start', label: 'Inicio', key: 'inicio' }, { handle: 'end', label: 'Fin', key: 'fin' }];
  return (
    <View testID="editor-extremos" pointerEvents="box-none" className="absolute left-16 right-3 top-3 flex-row gap-2 rounded-xl border border-outline/15 bg-surface p-1.5">
      {ends.map((end) => (
        <View key={end.key} className="flex-1 flex-row items-center gap-1">
          <Text className="pl-1 pr-0.5 text-[12px] font-semibold text-on-surface-variant">{end.label}</Text>
          {[-NUDGE_M, NUDGE_M].map((deltaM) => (
            <Pressable key={deltaM} testID={`editor-${end.key}-${deltaM < 0 ? 'menos' : 'mas'}`} accessibilityLabel={`${end.label} 10 m hacia ${deltaM < 0 ? 'atrás' : 'adelante'}`} onPress={() => onNudge(end.handle, deltaM)} className="h-10 flex-1 items-center justify-center rounded-lg bg-primary/10">
              <Text className="font-mono text-[12px] font-bold text-primary">{deltaM < 0 ? '−10' : '+10'}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

type StreetFormProps = { draft: StreetDraft; stages: WorkMapStage[]; error: string | null; saving: boolean; change: (next: Partial<StreetDraft>) => void; onSave: () => void; /** A side panel has room: no folding. */ foldable: boolean };

/** «Jr. Los Pinos · 65 m · 6 m de ancho»: what a folded form still tells. */
const foldedSummary = (draft: StreetDraft): string => [draft.name.trim() || 'Sin nombre', metersLabel(streetDraftLengthM(draft)), draft.widthM === null ? null : `${draft.widthM} m de ancho`].filter(Boolean).join(' · ');

/**
 * Name and width in one row, the length under them, the button last (José 27/11). On a phone the form
 * folds to its summary and the button, so the map gets the screen while the ends are dragged.
 */
export function StreetForm(props: StreetFormProps) {
  const colors = useColores();
  const [folded, setFolded] = useState(false);
  const { draft } = props;
  const area = streetDraftArea(draft);
  const open = !props.foldable || !folded || Boolean(props.error);
  return (
    <View>
      {props.foldable ? (
        <Pressable testID="editor-calle-plegar" accessibilityLabel={open ? 'Ocultar los datos de la calle' : 'Mostrar los datos de la calle'} onPress={() => setFolded(open)} className="-mt-1 mb-1 h-6 flex-row items-center justify-center">
          {open ? <ChevronDown size={18} color={colors['on-surface-variant']} /> : <ChevronUp size={18} color={colors['on-surface-variant']} />}
        </Pressable>
      ) : null}
      {open ? (
        <>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className={LABEL}>Nombre</Text>
              <TextInput testID="editor-calle-nombre" value={draft.name} maxLength={80} placeholder="Jr. Los Pinos" onChangeText={(name) => props.change({ name })} className={FIELD} />
            </View>
            <View className="w-24">
              <Text className={LABEL}>Ancho (m)</Text>
              <TextInput testID="editor-calle-ancho" keyboardType="decimal-pad" value={draft.widthM === null ? '' : String(draft.widthM)} placeholder="6.0" onChangeText={(text) => props.change({ widthM: text.trim() ? Number(text.replace(',', '.')) : null })} className={FIELD} />
            </View>
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <Text className={LABEL}>Largo</Text>
            <Text testID="editor-calle-largo" className="font-mono text-[14px] font-bold text-on-surface">{metersLabel(streetDraftLengthM(draft))}</Text>
            <Text className="text-[10px] font-bold text-primary">Auto</Text>
            <Text testID="editor-calle-extremos" numberOfLines={1} className="flex-1 font-mono text-[11px] text-on-surface-variant">{streetDraftEnds(draft) ?? LENGTH_HINT}</Text>
            {area ? <Text testID="editor-calle-area" accessibilityLabel={`Área neta ${area}`} className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[13px] font-bold text-primary">{area}</Text> : null}
          </View>
          <StageField stages={props.stages} stageId={draft.stageId} onPick={(stageId) => props.change({ stageId })} />
        </>
      ) : (
        <Text testID="editor-calle-resumen" numberOfLines={1} className="font-mono text-[13px] text-on-surface">{foldedSummary(draft)}</Text>
      )}
      {props.error ? <Text testID="editor-calle-error" className="mt-2 text-[13px] font-semibold text-error">{props.error}</Text> : null}
      <Pressable testID="editor-calle-guardar" disabled={props.saving} onPress={props.onSave} className={`mt-2 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary ${props.saving ? 'opacity-60' : ''}`}>
        <Save size={18} color={colors['on-primary']} /><Text className="text-[15px] font-semibold text-on-primary">{props.saving ? 'Guardando…' : 'Guardar calle'}</Text>
      </Pressable>
    </View>
  );
}
