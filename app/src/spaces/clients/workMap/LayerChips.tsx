import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { AVANCE_NO_WORKS, percentLabel, type AvanceChip } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { NewLayerButton } from './WorkLayers';
import { MAP_SHADOW } from './MapFloating';

type ChipsProps = {
  chips: AvanceChip[];
  onPick: (id: string) => void;
  /** «+ Trabajo» and the empty state (Modo Avance); the main map has neither. */
  onNewLayer?: () => void;
  /** Test ids: `avance-trabajo-<id>` in Modo Avance, `mapa-capa-<id>` on the map (ma01). */
  testPrefix: string;
  /** Room kept at the end for a button floating over the strip («Más»): the last chip scrolls fully clear of it. */
  endInset?: number;
};

const STRIP_PADDING = 12;

/** A long name gives way to the percent: 3–4 chips fit across a 390 dp phone (José 28/11). */
const CHIP_NAME_MAX_WIDTH = 132;

/**
 * The strip of layers (designs av-01 and ma01): compact 40 dp chips (José 28/11: «está grandazo»)
 * with the colour dot, the name and the percent; the picked one raised with a small check. The
 * strip scrolls sideways.
 */
export function LayerChips(props: ChipsProps) {
  const colors = useColores();
  if (!props.chips.length) {
    return props.onNewLayer ? (
      <View testID="avance-sin-trabajos" className="mx-3 gap-2 rounded-2xl bg-surface p-3" style={MAP_SHADOW}>
        <Text className="text-[14px] text-on-surface">{AVANCE_NO_WORKS}</Text>
        <NewLayerButton testID="trabajo-nueva" label="Agregar trabajo" onPress={props.onNewLayer} />
      </View>
    ) : null;
  }
  return (
    <ScrollView horizontal style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingLeft: STRIP_PADDING, paddingRight: STRIP_PADDING + (props.endInset ?? 0) }}>
      {props.chips.map((chip) => (
        <Pressable key={chip.id} testID={`${props.testPrefix}-${chip.id}`} accessibilityRole="button" accessibilityLabel={chip.label} accessibilityState={{ selected: chip.selected }} onPress={() => props.onPick(chip.id)} className={`h-10 flex-row items-center gap-1.5 rounded-xl border px-3 ${chip.selected ? 'border-primary/60 bg-surface' : 'border-outline/15 bg-surface/90'}`} style={MAP_SHADOW}>
          <View className="h-2.5 w-2.5 rounded-full border-[1.5px] border-on-surface/40" style={{ backgroundColor: chip.color }} />
          <Text numberOfLines={1} className={`text-[14px] ${chip.selected ? 'font-bold' : 'font-medium'} text-on-surface`} style={{ maxWidth: CHIP_NAME_MAX_WIDTH }}>{chip.name}</Text>
          <Text className="font-mono text-[13px] text-on-surface-variant">{percentLabel(chip.percent)}</Text>
          {chip.selected ? <Check size={14} color={colors.primary} /> : null}
        </Pressable>
      ))}
      {props.onNewLayer ? (
        <Pressable testID="avance-trabajo-nuevo" accessibilityRole="button" onPress={props.onNewLayer} className="h-10 flex-row items-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-surface px-3" style={MAP_SHADOW}>
          <Plus size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Trabajo</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
