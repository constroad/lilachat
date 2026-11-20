import { ActivityIndicator, Text, View } from 'react-native';
import { Check, MapPinOff } from 'lucide-react-native';
import { placeLineOf, type PhotoPlaceReading } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const TONE = { busy: 'text-on-surface-variant', ok: 'text-primary', warn: 'text-on-surface-variant', error: 'text-error' } as const;

/** The GPS of the open photo section (José 19/11): «Obteniendo ubicación…» with its spinner, ready, or why it failed. */
export function PlaceStatus(props: { reading: PhotoPlaceReading | null }) {
  const colors = useColores();
  const line = placeLineOf(props.reading);
  if (!line) return null;
  const color = line.tone === 'error' ? colors.error : line.tone === 'ok' ? colors.primary : colors['on-surface-variant'];
  const icon = line.tone === 'busy' ? <ActivityIndicator testID="ubicacion-cargando" size="small" color={color} /> : line.tone === 'ok' ? <Check size={16} color={color} /> : <MapPinOff size={16} color={color} />;
  return (
    <View testID="ubicacion-estado" accessibilityLiveRegion="polite" accessibilityState={{ busy: line.tone === 'busy' }} className="flex-row items-center gap-2">
      {icon}
      <Text className={`min-w-0 flex-1 text-[13px] font-semibold ${TONE[line.tone]}`}>{line.text}</Text>
    </View>
  );
}
