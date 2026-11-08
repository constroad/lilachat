import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ClipboardCheck } from 'lucide-react-native';
import { PRIME_COAT_HOW, PRIME_COAT_TITLE, primeCoatDraftOf, primeCoatExplain, primeCoatGaps, primeCoatLength, suggestPrimeCoat, type ManualProgressDraft, type MapPhoto, type WorkMap } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const KICKER = 'text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant';

/**
 * #253 on the phone: the stretches the photos of the prime coat report mark. Its button opens the
 * manual progress form of that street already filled; nothing counts until it is sent.
 */
export function PrimeCoatSuggestions(props: { map: WorkMap; photos: MapPhoto[]; onRecord: (streetId: string, draft: ManualProgressDraft) => void }) {
  const colors = useColores();
  const suggestion = useMemo(() => suggestPrimeCoat(props.map, props.photos), [props.map, props.photos]);
  if (!suggestion.stretches.length) return null;
  const gaps = primeCoatGaps(suggestion);
  return (
    <View testID="imprimacion-sugerida" className="gap-3">
      <View>
        <Text className={KICKER}>Control de imprimación</Text>
        <Text className="text-[16px] font-semibold text-on-surface">{PRIME_COAT_TITLE}</Text>
        <Text className="mt-0.5 text-[13px] text-on-surface-variant">{PRIME_COAT_HOW}</Text>
      </View>
      {gaps ? <Text testID="imprimacion-sin-ubicar" className="rounded-xl border border-outline/15 bg-surface px-3 py-2 text-[13px] text-on-surface-variant">No suman: {gaps}.</Text> : null}
      {suggestion.stretches.map((stretch) => (
        <View key={stretch.id} testID={`imprimacion-tramo-${stretch.streetId}`} className="rounded-xl border border-outline/15 bg-surface p-3">
          <Text className="text-[16px] font-semibold text-on-surface">{stretch.streetName}</Text>
          <Text className="font-mono text-[24px] font-bold text-on-surface">{primeCoatLength(stretch)}</Text>
          <Text className="mt-1 text-[14px] text-on-surface-variant">{primeCoatExplain(stretch)}</Text>
          <Pressable testID={`imprimacion-registrar-${stretch.streetId}`} onPress={() => props.onRecord(stretch.streetId, primeCoatDraftOf(props.map, stretch))} className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary">
            <ClipboardCheck size={18} color={colors['on-primary']} /><Text className="text-[15px] font-semibold text-on-primary">Revisar y registrar</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
