import { Pressable, Text } from 'react-native';
import { Layers } from 'lucide-react-native';
import { useColores } from '../../../ui/tema';

/**
 * What floats over the map on the phone (José 28/11, design ma01): the strip of layers, «Más» and
 * the floating «Capas»; nothing at the foot. A view over the map needs its own elevation on Android.
 */
export const MAP_ROUND = 'h-10 w-10 items-center justify-center rounded-full border border-outline/15 bg-surface';
export const MAP_SHADOW = { elevation: 4 } as const;

/**
 * «Capas»: the floating button that opens «Capas y leyenda» (José 28/11: closed until pressed),
 * with its word so nobody has to guess the icon.
 */
export function LayersButton(props: { open: boolean; onToggle: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="mapa-capas-abrir" accessibilityRole="button" accessibilityLabel="Capas y leyenda" accessibilityState={{ selected: props.open }} onPress={props.onToggle} className={`h-10 flex-row items-center gap-1.5 rounded-full border px-3.5 ${props.open ? 'border-primary/40 bg-primary/10' : 'border-outline/15 bg-surface'}`} style={MAP_SHADOW}>
      <Layers size={18} color={props.open ? colors.primary : colors['on-surface']} />
      <Text className={`text-[14px] font-semibold ${props.open ? 'text-primary' : 'text-on-surface'}`}>Capas</Text>
    </Pressable>
  );
}
