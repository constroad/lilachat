import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Check, Pointer } from 'lucide-react-native';
import { AVANCE_NO_WORKS, AVANCE_PICK_STREET, AVANCE_TITLE, avanceChipsOf, avanceHint, avancePickedWork, avanceTargetOf, brushLinesOf, createdOrRefusal, sendWorkTag, stretchLineOf, streetAtTap, WORK_TAG_COLORS, workMapView, workTagRequest, type AvanceChip, type MapEditSend, type WorkMap, type WorkMapLine, type WorkMapPoint } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { NewLabel } from './ScopeForm';
import { MAP_SHADOW } from './MapFloating';
import { AvancePanel } from './AvancePanel';
import { WorkMapSurface } from './WorkMapSurface';

/** The strip of works (design av-01): 56 dp chips, the picked one with its check. */
function WorkChips(props: { chips: AvanceChip[]; onPick: (id: string) => void; send: MapEditSend }) {
  const colors = useColores();
  if (!props.chips.length) {
    return (
      <View testID="avance-sin-trabajos" className="mx-3 gap-2 rounded-2xl bg-surface p-3" style={MAP_SHADOW}>
        <Text className="text-[14px] text-on-surface">{AVANCE_NO_WORKS}</Text>
        <NewLabel testID="trabajo" placeholder="Agregar trabajo" colors={WORK_TAG_COLORS} onCreate={(name, color) => createdOrRefusal(props.send(workTagRequest(name, color), sendWorkTag))} />
      </View>
    );
  }
  return (
    <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
      {props.chips.map((chip) => (
        <Pressable key={chip.id} testID={`avance-trabajo-${chip.id}`} accessibilityRole="button" accessibilityState={{ selected: chip.selected }} onPress={() => props.onPick(chip.id)} className={`h-14 flex-row items-center gap-2 rounded-full border px-5 ${chip.selected ? 'border-primary bg-primary/15' : 'border-outline/15 bg-surface'}`} style={MAP_SHADOW}>
          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: chip.color }} />
          <Text className="text-[16px] font-semibold text-on-surface">{chip.label}</Text>
          {chip.selected ? <Check size={18} color={colors.primary} /> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Head(props: { title: string; onExit: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-3 px-3">
      <Pressable testID="avance-salir" accessibilityLabel="Salir del modo avance" onPress={props.onExit} className="h-12 w-12 items-center justify-center rounded-full bg-surface" style={MAP_SHADOW}>
        <ArrowLeft size={22} color={colors['on-surface']} />
      </Pressable>
      <View className="min-w-0 flex-1 rounded-2xl bg-surface/90 px-3 py-1">
        <Text numberOfLines={1} className="font-mono text-[12px] font-bold uppercase tracking-[1.5px] text-primary">{props.title}</Text>
        <Text className="text-[20px] font-bold text-on-surface">{AVANCE_TITLE}</Text>
      </View>
    </View>
  );
}

function Hint(props: { text: string; error: string | null }) {
  const colors = useColores();
  return (
    <View testID="avance-pista" className="mx-3 flex-row items-center gap-3 rounded-full bg-surface/95 px-4 py-3" style={MAP_SHADOW}>
      <Pointer size={20} color={colors.primary} />
      <Text className={`flex-1 text-[14px] font-semibold ${props.error ? 'text-error' : 'text-on-surface'}`}>{props.error ?? props.text}</Text>
    </View>
  );
}

/** The work's stretches in its colour and the tapped street on top, in the stretch colour. */
function linesOf(map: WorkMap, workId: string | null, streetId: string | null): WorkMapLine[] {
  const own = workId ? brushLinesOf(map, { kind: 'work', id: workId }) : [];
  const street = map.streets.find((one) => one.id === streetId);
  const picked = street ? stretchLineOf(map, street.id, 0, street.lengthM) : null;
  return picked ? [...own, picked] : own;
}

/**
 * «Modo Avance» on the phone (design av-01, José 27/11): the strip of works on top, a tap on a
 * street opens its panel, and «Guardar avance» sends it to wait for an admin's approval.
 */
export function AvanceMode(props: { map: WorkMap; title: string; send: MapEditSend; onExit: () => void }) {
  const { map } = props;
  const margins = useMargenes();
  const [chosen, setChosen] = useState<string | null>(null);
  const [streetId, setStreetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workId = avancePickedWork(map, chosen);
  const chips = useMemo(() => avanceChipsOf(map, workId), [map, workId]);
  const view = useMemo(() => workMapView(map), [map]);
  const target = workId && streetId ? avanceTargetOf(map, streetId, workId) : null;
  const workName = chips.find((chip) => chip.selected)?.name ?? '';
  const tap = (place: WorkMapPoint) => {
    const found = streetAtTap(map, place);
    setError(found ? null : AVANCE_PICK_STREET);
    if (found) setStreetId(found);
  };
  return (
    <Modal visible animationType="slide" onRequestClose={props.onExit}>
      <View testID="avance-modo" className="flex-1 bg-background">
        <WorkMapSurface view={view} moves controlsInset={margins.pie} stretches={linesOf(map, workId, streetId)} onTap={workId ? tap : undefined} />
        <View pointerEvents="box-none" className="absolute inset-x-0 gap-3" style={{ top: margins.cabecera + 8 }}>
          <Head title={props.title} onExit={props.onExit} />
          <WorkChips chips={chips} onPick={(id) => { setChosen(id); setError(null); }} send={props.send} />
          {workId ? <Hint text={avanceHint(workName)} error={error} /> : null}
        </View>
        {target ? <AvancePanel key={`${target.streetId}|${target.workId}`} map={map} target={target} send={props.send} bottom={margins.pie} onClose={() => setStreetId(null)} /> : null}
      </View>
    </Modal>
  );
}
