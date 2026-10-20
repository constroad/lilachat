import { Pressable, Switch, Text, View } from 'react-native';
import { Eraser, Paintbrush } from 'lucide-react-native';
import { BRUSH_SIZES, type BrushSize, type MaskMode } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

const SIZES = Object.keys(BRUSH_SIZES) as BrushSize[];
/** On-screen dot of each brush size (dp). */
const SIZE_DOT: Record<BrushSize, number> = { S: 8, M: 14, L: 22 };

/**
 * «Recortar» (José, 20/10: «the background was not fully removed and there is
 * no way to erase a part»): erase or restore with the finger, three brush
 * sizes, and the automatic cutout on or off. Like Telegram's sticker editor.
 */
export function CutoutTools(props: {
  mode: MaskMode;
  size: BrushSize;
  automatic: boolean;
  /** No automatic cutout yet (the model was downloading, or there was nobody to cut). */
  automaticAvailable: boolean;
  onMode: (mode: MaskMode) => void;
  onSize: (size: BrushSize) => void;
  onAutomatic: () => void;
}) {
  const colors = useColores();
  const tool = (mode: MaskMode, label: string, Icon: typeof Eraser) => {
    const active = props.mode === mode;
    return (
      <Pressable testID={`btn-${mode === 'erase' ? 'borrar' : 'restaurar'}-sticker`} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => props.onMode(mode)} className={`h-10 flex-row items-center gap-1.5 rounded-full px-3 ${active ? 'bg-primary' : ''}`}>
        <Icon size={17} color="white" />
        <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View testID="herramientas-recorte" className="gap-2 border-t px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <View className="flex-row items-center justify-between">
        <Text className="min-w-0 flex-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {props.mode === 'erase' ? 'Pasa el dedo por lo que quieras quitar.' : 'Pasa el dedo por lo que quieras recuperar de la foto.'}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-[12px]" style={{ color: 'rgba(255,255,255,0.65)' }}>Fondo automático</Text>
          <Switch testID="switch-fondo-automatico" value={props.automatic && props.automaticAvailable} onValueChange={props.onAutomatic} trackColor={{ true: colors.primary, false: 'rgba(255,255,255,0.25)' }} thumbColor="white" />
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-0.5 rounded-full p-1" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          {tool('erase', 'Borrar', Eraser)}
          {tool('restore', 'Restaurar', Paintbrush)}
        </View>
        <View className="flex-row items-center gap-1">
          {SIZES.map((size) => (
            <Pressable key={size} testID={`pincel-${size}`} accessibilityLabel={`Pincel ${size}`} accessibilityState={{ selected: props.size === size }} onPress={() => props.onSize(size)} className="h-10 w-10 items-center justify-center rounded-full" style={{ borderWidth: props.size === size ? 2 : 0, borderColor: colors.primary }}>
              <View className="rounded-full" style={{ width: SIZE_DOT[size], height: SIZE_DOT[size], backgroundColor: 'white' }} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
