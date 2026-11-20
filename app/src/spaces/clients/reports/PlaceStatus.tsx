import { ActivityIndicator, Text, View } from 'react-native';
import { Check, MapPin, MapPinOff } from 'lucide-react-native';
import { placeLineOf, type PhotoPlaceReading } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const TONE = { busy: 'text-on-surface', ok: 'text-primary', warn: 'text-on-surface-variant', error: 'text-error' } as const;
const CARD = { busy: 'border-outline/20 bg-background', ok: 'border-primary/25 bg-primary/5', warn: 'border-outline/20 bg-background', error: 'border-error/40 bg-error/5' } as const;

/**
 * The GPS of the open photo section (José 19/11): «Obteniendo ubicación…» with its spinner, ready, or why it
 * failed. A card over the fields, as design imp-01/02 draws it: the state, the pin and the line.
 */
export function PlaceStatus(props: { reading: PhotoPlaceReading | null }) {
  const colors = useColores();
  const line = placeLineOf(props.reading);
  if (!line) return null;
  const color = line.tone === 'error' ? colors.error : line.tone === 'ok' ? colors.primary : colors['on-surface-variant'];
  const icon = line.tone === 'busy' ? <ActivityIndicator testID="ubicacion-cargando" size="small" color={colors.primary} /> : line.tone === 'ok' ? <Check size={18} color={color} /> : <MapPinOff size={18} color={color} />;
  return (
    <View testID="ubicacion-estado" accessibilityLiveRegion="polite" accessibilityState={{ busy: line.tone === 'busy' }} className={`min-h-[44px] flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 ${CARD[line.tone]}`}>
      {icon}
      {line.tone === 'error' ? null : <MapPin size={16} color={colors.primary} />}
      <Text className={`min-w-0 flex-1 text-[14px] font-semibold ${TONE[line.tone]}`}>{line.text}</Text>
    </View>
  );
}
