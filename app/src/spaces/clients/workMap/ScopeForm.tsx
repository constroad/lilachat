import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Check, Plus, Save } from 'lucide-react-native';
import { createdOrRefusal, labelFormIdle, runLabelCreate, runScopeSave, sendWorkStage, sendWorkTag, toggleScopeWork, WORK_TAG_COLORS, workStageRequest, workTagRequest, type LabelForm, type MapEditSend, type ScopeDraft, type WorkMap } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { KICKER } from './WorkMapPanel';

const FIELD = 'mt-1 h-12 rounded-xl border border-outline/25 bg-background px-3 text-[15px] text-on-surface';
const LABEL = 'text-[12px] font-semibold uppercase text-on-surface-variant';
const CHIP = 'h-10 flex-row items-center gap-1.5 rounded-full border px-3';
const numberOrNull = (text: string): number | null => (text.trim() === '' ? null : Number(text.replace(',', '.')));

type NewLabelProps = { testID: string; placeholder: string; colors?: readonly string[]; onCreate: (name: string, color: string) => Promise<string | null> };

/** «Nueva etapa» / «Nuevo trabajo» right where they are picked (o-04, o-05): a name, and a color for a work. */
function NewLabel(props: NewLabelProps) {
  const palette = useColores();
  const [form, setForm] = useState<LabelForm>(() => labelFormIdle(props.colors?.[0]));
  const set = (next: Partial<LabelForm>) => setForm((before) => ({ ...before, ...next }));
  const { open, name, color, error, busy } = form;
  if (!open) {
    return (
      <Pressable testID={`${props.testID}-nueva`} onPress={() => set({ open: true })} className={`${CHIP} border-dashed border-primary/40`}>
        <Plus size={14} color={palette.primary} /><Text className="text-[14px] font-semibold text-primary">{props.placeholder}</Text>
      </Pressable>
    );
  }
  return (
    <View className="w-full rounded-xl border border-outline/15 bg-background p-3">
      <TextInput testID={`${props.testID}-nombre`} autoFocus value={name} maxLength={60} placeholder={props.placeholder} onChangeText={(text) => set({ error: null, name: text })} className={FIELD} />
      {props.colors ? (
        <View accessibilityRole="radiogroup" className="mt-2 flex-row flex-wrap gap-2">
          {props.colors.map((one) => (
            <Pressable key={one} testID={`${props.testID}-color-${one.slice(1)}`} accessibilityRole="radio" accessibilityState={{ checked: color === one }} onPress={() => set({ color: one })} className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: one }}>
              {color === one ? <Check size={16} color={palette.background} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {error ? <Text className="mt-2 text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="mt-2 flex-row gap-2">
        <Pressable onPress={() => setForm(labelFormIdle(color))} className="h-11 flex-1 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[14px] font-semibold text-on-surface">Cancelar</Text></Pressable>
        <Pressable testID={`${props.testID}-crear`} disabled={busy} onPress={() => void runLabelCreate(form, props.onCreate, setForm)} className={`h-11 flex-1 items-center justify-center rounded-xl bg-primary ${busy ? 'opacity-60' : ''}`}><Text className="text-[14px] font-semibold text-on-primary">{busy ? 'Creando…' : 'Crear'}</Text></Pressable>
      </View>
    </View>
  );
}

function ChoiceChip(props: { testID: string; on: boolean; label: string; dot?: string; onPress: () => void }) {
  return (
    <Pressable testID={props.testID} accessibilityState={{ selected: props.on }} onPress={props.onPress} className={`${CHIP} ${props.on ? 'border-primary bg-primary/10' : 'border-outline/20'}`}>
      {props.dot ? <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: props.dot }} /> : null}
      <Text className={`text-[14px] font-semibold ${props.on ? 'text-primary' : 'text-on-surface'}`}>{props.label}</Text>
    </Pressable>
  );
}

type FormProps = { map: WorkMap; streetId: string; lengthM: number; initial: ScopeDraft; scopeId?: string; send: MapEditSend; onDone: () => void };

/** «Agregar tramo» / edit a stretch (o-03): where it starts and ends, its works and its stage. */
export function ScopeForm(props: FormProps) {
  const { map } = props;
  const colors = useColores();
  const [draft, setDraft] = useState(props.initial);
  const [entryId] = useState(() => randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const change = (next: Partial<ScopeDraft>) => { setError(null); setDraft((before) => ({ ...before, ...next })); };
  const save = async () => {
    setSaving(true);
    const failure = await runScopeSave({ map, streetId: props.streetId, lengthM: props.lengthM, draft, entryId, scopeId: props.scopeId, send: props.send });
    setSaving(false);
    if (failure) return setError(failure);
    props.onDone();
  };
  return (
    <View testID="tramo-formulario" className="rounded-xl border-[1.5px] border-primary/30 bg-surface p-4">
      <Text className={KICKER}>{props.scopeId ? 'Editar tramo' : 'Nuevo tramo'}</Text>
      <View className="mt-2 flex-row gap-3">
        <View className="flex-1"><Text className={LABEL}>Desde (m)</Text><TextInput testID="tramo-desde" keyboardType="decimal-pad" value={draft.fromM === null ? '' : String(draft.fromM)} onChangeText={(text) => change({ fromM: numberOrNull(text) })} className={`${FIELD} font-mono`} /></View>
        <View className="flex-1"><Text className={LABEL}>Hasta (m)</Text><TextInput testID="tramo-hasta" keyboardType="decimal-pad" value={draft.toM === null ? '' : String(draft.toM)} onChangeText={(text) => change({ toM: numberOrNull(text) })} className={`${FIELD} font-mono`} /></View>
      </View>
      <Text className={`${LABEL} mt-3`}>Trabajos</Text>
      <View className="mt-1 flex-row flex-wrap gap-2">
        {map.works.map((work) => <ChoiceChip key={work.id} testID={`tramo-trabajo-${work.id}`} on={draft.workIds.includes(work.id)} label={work.name} dot={work.color} onPress={() => setDraft((before) => toggleScopeWork(before, work.id))} />)}
        <NewLabel testID="trabajo" placeholder="Nuevo trabajo" colors={WORK_TAG_COLORS} onCreate={(name, color) => createdOrRefusal(props.send(workTagRequest(name, color), sendWorkTag))} />
      </View>
      <Text className={`${LABEL} mt-3`}>Etapa</Text>
      <View className="mt-1 flex-row flex-wrap gap-2">
        {[{ id: null, name: 'Sin etapa' }, ...map.stages].map((stage) => <ChoiceChip key={stage.id ?? 'none'} testID={`tramo-etapa-${stage.id ?? 'ninguna'}`} on={draft.stageId === stage.id} label={stage.name} onPress={() => change({ stageId: stage.id })} />)}
        <NewLabel testID="etapa" placeholder="Nueva etapa" onCreate={(name) => createdOrRefusal(props.send(workStageRequest(name), sendWorkStage))} />
      </View>
      {error ? <Text testID="tramo-error" className="mt-3 text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="mt-4 flex-row gap-2">
        <Pressable onPress={props.onDone} className="h-12 flex-1 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[15px] font-semibold text-on-surface">Cancelar</Text></Pressable>
        <Pressable testID="tramo-guardar" disabled={saving} onPress={() => void save()} className={`h-12 flex-[2] flex-row items-center justify-center gap-2 rounded-xl bg-primary ${saving ? 'opacity-60' : ''}`}>
          <Save size={18} color={colors['on-primary']} /><Text className="text-[15px] font-semibold text-on-primary">{saving ? 'Guardando…' : 'Guardar tramo'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
