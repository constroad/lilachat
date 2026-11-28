import { Pressable, Text, TextInput, View } from 'react-native';
import { Check, Pencil, X } from 'lucide-react-native';
import { batchDoneLabel, batchStreetLengthM, metersLabel, type BatchStreet, type StreetBatch } from '@lilachat/shared';
import { DecimalInput } from '../../../ui/DecimalInput';
import { useColores } from '../../../ui/tema';

const LABEL = 'text-[11px] font-semibold uppercase tracking-[1px] text-on-surface-variant';

/** «Área de trabajo · 3 calles · 917 m» (ma02). */
export function BatchHead(props: { total: string }) {
  return (
    <View className="flex-row items-end justify-between gap-2">
      <View className="flex-1">
        <Text className={LABEL}>Área de trabajo</Text>
        <Text testID="lote-total" className="text-[22px] font-bold text-on-surface">{props.total}</Text>
      </View>
      <Text className="rounded-md border border-outline/25 px-2 py-1 font-mono text-[10px] font-bold uppercase text-on-surface-variant">Total seleccionado</Text>
    </View>
  );
}

type RowProps = { street: BatchStreet; number: number; onName: (name: string) => void; onWidth: (widthM: number | null) => void; onRemove: () => void };

/** One street of the list: its number on the map, a name to fix, its length, an optional width and «Quitar». */
export function BatchRow(props: RowProps) {
  const colors = useColores();
  const { street } = props;
  return (
    <View testID={`lote-calle-${props.number}`} className={`rounded-xl border bg-surface px-3 py-2 ${street.error ? 'border-error' : 'border-outline/20'}`}>
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-on-surface"><Text className="font-mono text-[14px] font-bold text-surface">{props.number}</Text></View>
        <TextInput testID={`lote-nombre-${props.number}`} accessibilityLabel={`Nombre de la calle ${props.number}`} value={street.name} maxLength={80} placeholder="Nombre de la calle" onChangeText={props.onName} className="h-10 flex-1 text-[15px] font-semibold text-on-surface" />
        <Text className="font-mono text-[13px] text-on-surface-variant">{metersLabel(batchStreetLengthM(street))}</Text>
        <DecimalInput testID={`lote-ancho-${props.number}`} accessibilityLabel={`Ancho de la calle ${props.number} en metros`} value={street.widthM} placeholder="Ancho" onValue={props.onWidth} className="h-9 w-16 rounded-lg border border-outline/25 bg-background px-2 font-mono text-[13px] text-on-surface" />
        <Pressable testID={`lote-quitar-${props.number}`} accessibilityLabel={`Quitar ${street.name || 'la calle'}`} onPress={props.onRemove} className="h-10 w-10 items-center justify-center rounded-lg">
          <X size={18} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      {street.error ? <Text testID={`lote-error-${props.number}`} className="mt-1 text-[12px] font-semibold text-error">{street.error}</Text> : null}
    </View>
  );
}

export function BatchRows(props: { batch: StreetBatch; onEdit: (key: string, change: Partial<Pick<BatchStreet, 'name' | 'widthM'>>) => void; onRemove: (street: BatchStreet) => void }) {
  return (
    <View className="gap-2">
      {props.batch.streets.map((street, index) => (
        <BatchRow key={street.key} street={street} number={index + 1} onName={(name) => props.onEdit(street.key, { name })} onWidth={(widthM) => props.onEdit(street.key, { widthM })} onRemove={() => props.onRemove(street)} />
      ))}
    </View>
  );
}

/** «Trazar a mano (si la calle no sale en el mapa)»: the single-street editor, by hand. */
export function HandButton(props: { onPress: () => void; disabled: boolean }) {
  const colors = useColores();
  return (
    <Pressable testID="lote-a-mano" disabled={props.disabled} onPress={props.onPress} className={`h-12 flex-row items-center justify-center gap-2 rounded-xl border border-outline/25 ${props.disabled ? 'opacity-50' : ''}`}>
      <Pencil size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-on-surface">Trazar a mano (si la calle no sale en el mapa)</Text>
    </Pressable>
  );
}

/** «Listo · 3 calles», or «Guardando 2 de 5…» while it saves. */
export function DoneButton(props: { count: number; progress: string | null; onPress: () => void }) {
  const colors = useColores();
  const busy = props.progress !== null;
  return (
    <Pressable testID="lote-listo" disabled={busy || props.count === 0} onPress={props.onPress} className={`h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary ${busy || props.count === 0 ? 'opacity-60' : ''}`}>
      <Check size={18} color={colors['on-primary']} /><Text className="text-[16px] font-bold text-on-primary">{props.progress ?? batchDoneLabel(props.count)}</Text>
    </Pressable>
  );
}
