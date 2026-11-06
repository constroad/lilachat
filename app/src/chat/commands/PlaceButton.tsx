import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { PLACE_BUTTON, placeFieldValue } from '@lilachat/shared';
import { devicePlaceNow } from '../../spaces/clients/reports/devicePlace';
import { useColores } from '../../ui/tema';

/** «Usar mi ubicación» under a place field (José, 06/11): it writes the link to where the phone is, and the person can still type. */
export function PlaceButton({ onPick }: { onPick: (value: string) => void }) {
  const colors = useColores();
  const [state, setState] = useState<'idle' | 'taking' | 'failed'>('idle');
  async function take() {
    setState('taking');
    const value = placeFieldValue(await devicePlaceNow());
    if (value) onPick(value);
    setState(value ? 'idle' : 'failed');
  }
  return (
    <View className="mt-2 items-start">
      <Pressable testID="btn-usar-ubicacion" accessibilityRole="button" accessibilityLabel={PLACE_BUTTON.take} disabled={state === 'taking'} onPress={() => void take()} className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-outline/25 px-4" style={state === 'taking' ? { opacity: 0.6 } : undefined}>
        <MapPin size={18} color={colors.primary} />
        <Text className="text-[15px] font-semibold text-primary">{state === 'taking' ? PLACE_BUTTON.taking : PLACE_BUTTON.take}</Text>
      </Pressable>
      {state === 'failed' ? <Text className="mt-1 text-[13px] text-error">{PLACE_BUTTON.failed}</Text> : null}
    </View>
  );
}
