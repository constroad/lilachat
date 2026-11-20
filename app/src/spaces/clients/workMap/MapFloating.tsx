import { Pressable } from 'react-native';
import { Info, Layers } from 'lucide-react-native';
import { useColores } from '../../../ui/tema';

/**
 * What floats over the map on the phone (José 20/11, design mapa-v2): round buttons down the
 * right side, small pills at the foot. A view over the map needs its own elevation on Android.
 */
export const MAP_ROUND = 'h-12 w-12 items-center justify-center rounded-full border border-outline/15 bg-surface';
export const MAP_PILL = 'h-11 flex-row items-center gap-2 rounded-full border border-outline/15 bg-surface px-4';
export const MAP_SHADOW = { elevation: 4 } as const;
const ON = 'h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10';

/** «Capas»: opens the sheet with «Capas y leyenda» and the progress under them. */
export function LayersButton(props: { open: boolean; onToggle: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="mapa-capas-abrir" accessibilityLabel="Capas y leyenda" accessibilityState={{ selected: props.open }} onPress={props.onToggle} className={props.open ? ON : MAP_ROUND} style={MAP_SHADOW}>
      <Layers size={20} color={props.open ? colors.primary : colors['on-surface']} />
    </Pressable>
  );
}

/** «Leyenda»: the ⓘ that shows or hides the legend at the foot of the map. */
export function LegendButton(props: { open: boolean; onToggle: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="mapa-leyenda-abrir" accessibilityLabel="Leyenda" accessibilityState={{ expanded: props.open }} onPress={props.onToggle} className={props.open ? ON : MAP_ROUND} style={MAP_SHADOW}>
      <Info size={20} color={props.open ? colors.primary : colors['on-surface']} />
    </Pressable>
  );
}
