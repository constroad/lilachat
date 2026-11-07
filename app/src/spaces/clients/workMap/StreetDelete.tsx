import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { runStreetDelete, STREET_DELETE_ACTION, STREET_DELETE_ASKING, STREET_DELETE_IDLE, streetDeleteAsk, type StreetDeleteState, type WorkMapStreetRow, type WorkProgressResult } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

export type StreetDeleteSend = (streetId: string) => Promise<WorkProgressResult>;

/**
 * «Borrar calle» on each street of the sheet (José 07/11: anyone deletes, an admin restores).
 * It asks first, naming the street, and shows Portal's refusal as it comes (a street with progress).
 */
export function StreetDelete({ street, send }: { street: WorkMapStreetRow; send: StreetDeleteSend }) {
  const colors = useColores();
  const [{ asking, busy, error }, setState] = useState<StreetDeleteState>(STREET_DELETE_IDLE);
  const ask = streetDeleteAsk(street.name);
  if (!asking) {
    return (
      <Pressable testID={`borrar-calle-${street.id}`} onPress={() => setState(STREET_DELETE_ASKING)} accessibilityLabel={`${STREET_DELETE_ACTION} ${street.name}`} className="h-11 w-11 items-center justify-center rounded-lg">
        <Trash2 size={18} color={colors['on-surface-variant']} />
      </Pressable>
    );
  }
  return (
    <View testID={`confirmar-borrar-${street.id}`} className="mt-3 w-full rounded-xl border border-error/30 bg-error/5 p-3">
      <Text className="text-[15px] font-bold text-on-surface">{ask.title}</Text>
      <Text className="mt-1 text-[13px] text-on-surface-variant">{ask.hint}</Text>
      {error ? <Text accessibilityRole="alert" className="mt-2 text-[14px] font-semibold text-error">{error}</Text> : null}
      <View className="mt-3 flex-row gap-2">
        <Pressable onPress={() => setState(STREET_DELETE_IDLE)} disabled={busy} className="h-12 flex-1 items-center justify-center rounded-xl border border-outline/20">
          <Text className="text-[14px] font-semibold text-on-surface">Cancelar</Text>
        </Pressable>
        <Pressable testID={`borrar-calle-si-${street.id}`} onPress={() => void runStreetDelete(send, street.id, setState)} disabled={busy} className={`h-12 flex-1 items-center justify-center rounded-xl bg-error ${busy ? 'opacity-60' : ''}`}>
          <Text className="text-[14px] font-bold text-background">{busy ? 'Borrando…' : 'Borrar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
