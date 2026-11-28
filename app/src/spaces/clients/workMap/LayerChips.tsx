import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { AVANCE_NO_WORKS, type AvanceChip } from '@lilachat/shared';
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
};

/**
 * The strip of layers (designs av-01 and ma01): 56 dp chips with the colour dot, the FULL name and
 * the percent, the picked one with its check. Chips size to their text; the strip scrolls sideways.
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
    <ScrollView horizontal style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
      {props.chips.map((chip) => (
        <Pressable key={chip.id} testID={`${props.testPrefix}-${chip.id}`} accessibilityRole="button" accessibilityState={{ selected: chip.selected }} onPress={() => props.onPick(chip.id)} className={`h-14 flex-row items-center gap-2 rounded-full border px-5 ${chip.selected ? 'border-primary bg-primary/15' : 'border-outline/15 bg-surface'}`} style={MAP_SHADOW}>
          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: chip.color }} />
          <Text className="text-[16px] font-semibold text-on-surface">{chip.label}</Text>
          {chip.selected ? <Check size={18} color={colors.primary} /> : null}
        </Pressable>
      ))}
      {props.onNewLayer ? (
        <Pressable testID="avance-trabajo-nuevo" accessibilityRole="button" onPress={props.onNewLayer} className="h-14 flex-row items-center gap-2 rounded-full border border-dashed border-primary/50 bg-surface px-5" style={MAP_SHADOW}>
          <Plus size={18} color={colors.primary} /><Text className="text-[16px] font-semibold text-primary">Trabajo</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
