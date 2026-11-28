import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Check, Plus } from 'lucide-react-native';
import { createMapWaiter, LAYER_MAP_WAIT_MS, LAYER_TAKEN, layerButtonLabel, layerChoicesOf, layerMetradoOf, layerPickIdle, layerPlanOf, layerStreetRowsOf, OTHER_LAYER_KEY, runLayerCreate, WORK_TAG_COLORS, type LayerChoice, type LayerPick, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { Interruptor } from '../../../ui/Interruptor';
import { useColores } from '../../../ui/tema';
import { PanelSheet, SHEET_LABEL } from './CutChips';
import { LabelColors } from './ScopeForm';

const CARD = 'rounded-2xl border-[1.5px] bg-surface';
/** Two chips a row on the phone (design ma03): the gap between them comes off each half. */
const HALF = { width: '48.5%' } as const;

function LayerChip(props: { choice: LayerChoice; on: boolean; onPick: () => void }) {
  const colors = useColores();
  const { choice } = props;
  return (
    <Pressable testID={`capa-${choice.key}`} disabled={choice.taken} accessibilityRole="radio" accessibilityState={{ checked: props.on, disabled: choice.taken }} onPress={props.onPick} style={HALF} className={`${CARD} min-h-[60px] flex-row items-center gap-2.5 px-3 ${props.on ? 'border-on-surface' : 'border-outline/20'} ${choice.taken ? 'opacity-50' : ''}`}>
      <View className="h-5 w-5 rounded-md" style={{ backgroundColor: choice.color }} />
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-on-surface">{choice.name}</Text>
        {choice.taken ? <Text className="text-[12px] font-semibold text-on-surface-variant">{LAYER_TAKEN}</Text> : null}
      </View>
      {props.on ? <View className="h-6 w-6 items-center justify-center rounded-full bg-on-surface"><Check size={14} color={colors.surface} /></View> : null}
    </Pressable>
  );
}

function OtherLayer(props: { pick: LayerPick; onPick: (next: Partial<LayerPick>) => void }) {
  const colors = useColores();
  if (props.pick.key !== OTHER_LAYER_KEY) {
    return (
      <Pressable testID="capa-otra" onPress={() => props.onPick({ key: OTHER_LAYER_KEY })} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-outline/40">
        <Plus size={18} color={colors['on-surface-variant']} /><Text className="text-[15px] font-semibold text-on-surface-variant">Otra…</Text>
      </Pressable>
    );
  }
  return (
    <View className={`${CARD} border-on-surface p-3`}>
      <TextInput testID="capa-otra-nombre" autoFocus value={props.pick.otherName} maxLength={60} placeholder="Nombre de la capa" onChangeText={(otherName) => props.onPick({ otherName })} className="h-12 rounded-xl border border-outline/25 bg-background px-3 text-[15px] text-on-surface" />
      <LabelColors testID="capa-otra" colors={WORK_TAG_COLORS} value={props.pick.otherColor} onPick={(otherColor) => props.onPick({ otherColor })} />
    </View>
  );
}

function Streets(props: { map: WorkMap; pick: LayerPick; onPick: (next: Partial<LayerPick>) => void }) {
  const metrado = layerMetradoOf(props.map);
  return (
    <View className="gap-2">
      <Text className={SHEET_LABEL}>Paso 2 · En qué calles</Text>
      <View className={`${CARD} flex-row items-center gap-3 border-outline/20 px-4 py-3`}>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-on-surface">Todas las calles de la obra</Text>
          <Text testID="capa-metrado" className="mt-0.5 font-mono text-[13px] text-on-surface-variant">{metrado.line}</Text>
        </View>
        <Interruptor testID="capa-todas" value={props.pick.allStreets} onValueChange={(allStreets) => props.onPick({ allStreets })} />
      </View>
      {props.pick.allStreets
        ? layerStreetRowsOf(props.map).map((row) => (
          <View key={row.id} className={`${CARD} flex-row items-center gap-3 border-outline/15 px-4 py-2.5`}>
            <View className="flex-1"><Text className="text-[15px] font-semibold text-on-surface">{row.name}</Text><Text className="font-mono text-[13px] text-on-surface-variant">{row.detail}</Text></View>
            {row.area ? <Text className="font-mono text-[14px] font-semibold text-on-surface">{row.area}</Text> : null}
          </View>
        ))
        : <Text className="text-[14px] text-on-surface-variant">Después tocas en el mapa las calles que la llevan.</Text>}
      {props.pick.allStreets && metrado.areaM2 ? <Text className="text-[13px] text-on-surface-variant">Metrado = largo × ancho de cada calle</Text> : null}
    </View>
  );
}

type Props = { open: boolean; map: WorkMap; send: MapEditSend; onCreated: (workId: string, paint: boolean) => void; onClose: () => void };

/**
 * «Nueva capa» on the phone (design ma03, José 28/11): a catalog chip with its color, «Todas las
 * calles de la obra» on by default with the metrado, and «Crear capa». Only «Otra…» is typed.
 */
export function NewLayerSheet(props: Props) {
  const colors = useColores();
  const [pick, setPick] = useState<LayerPick>(layerPickIdle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiter = useMemo(() => createMapWaiter(LAYER_MAP_WAIT_MS), []);
  useEffect(() => { waiter.offer(props.map); }, [waiter, props.map]);
  const change = (next: Partial<LayerPick>) => { setError(null); setPick((before) => ({ ...before, ...next })); };
  const plan = layerPlanOf(pick);
  const create = async () => {
    setBusy(true);
    const done = await runLayerCreate(props.map, plan, { send: props.send, newEntryId: randomUUID, findInMap: waiter.find });
    setBusy(false);
    setError(done.failure);
    if (done.failure || !done.workId) return;
    setPick(layerPickIdle());
    props.onCreated(done.workId, done.paint);
  };
  return (
    <PanelSheet open={props.open} onClose={props.onClose} testID="mapa-nueva-capa" keyboard="avoid">
      <Text className="text-[22px] font-bold text-on-surface">Nueva capa</Text>
      <View className="gap-2">
        <Text className={SHEET_LABEL}>Paso 1 · Qué capa</Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-between gap-y-2">
          {layerChoicesOf(props.map).map((choice) => <LayerChip key={choice.key} choice={choice} on={pick.key === choice.key} onPick={() => change({ key: choice.key })} />)}
        </View>
        <OtherLayer pick={pick} onPick={change} />
      </View>
      <Streets map={props.map} pick={pick} onPick={change} />
      {error ? <Text testID="capa-error" accessibilityRole="alert" className="text-[14px] font-semibold text-error">{error}</Text> : null}
      <Pressable testID="capa-crear" disabled={busy || !plan} onPress={() => void create()} className={`h-14 flex-row items-center justify-center gap-2.5 rounded-2xl bg-on-surface ${busy || !plan ? 'opacity-50' : ''}`}>
        {plan ? <View className="h-4 w-4 rounded-sm" style={{ backgroundColor: plan.color }} /> : null}
        <Text className="text-[17px] font-bold" style={{ color: colors.surface }}>{layerButtonLabel(plan, busy)}</Text>
      </Pressable>
    </PanelSheet>
  );
}
