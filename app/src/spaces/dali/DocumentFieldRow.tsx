import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { FIELD_VALUE_MAX, type ProspectField } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { Pill, TextButton } from './daliParts';
import { FieldGeoMap } from './FieldGeoMap';

/** «Confirmar» as it is, or «Corregir» with the right value: the seller settles what Dali read (fase 3). */
export type SettleField = (key: string, value?: string) => Promise<void>;

function CorrectForm({ field, onSave, onCancel }: { field: ProspectField; onSave: (value: string) => void; onCancel: () => void }) {
  const colors = useColores();
  const [value, setValue] = useState(field.value);
  const clean = value.trim();
  return (
    <View className="mt-1.5">
      <TextInput
        testID={`corregir-valor-${field.key}`}
        accessibilityLabel={`${field.label} correcto`}
        value={value}
        onChangeText={setValue}
        autoFocus
        maxLength={FIELD_VALUE_MAX}
        returnKeyType="done"
        onSubmitEditing={() => (clean ? onSave(clean) : undefined)}
        placeholderTextColor={colors['on-surface-variant']}
        className="min-h-[44px] rounded-lg border border-outline/30 bg-surface px-2.5 text-[15px] text-on-surface"
      />
      <View className="mt-1 flex-row justify-end">
        <TextButton tone="neutral" onPress={onCancel}>Cancelar</TextButton>
        <TextButton testID={`guardar-correccion-${field.key}`} onPress={() => (clean ? onSave(clean) : undefined)}>Guardar</TextButton>
      </View>
    </View>
  );
}

/** Below the value: who settled it, or the pill and its two actions while it waits. */
function Settlement({ field, onSettle }: { field: ProspectField; onSettle?: SettleField }) {
  const [correcting, setCorrecting] = useState(false);
  if (field.confirmedBy) return <Text testID={`confirmado-${field.key}`} className="mt-1 text-[12px] text-on-surface-variant">{`Confirmado por ${field.confirmedBy.name}`}</Text>;
  if (field.source !== 'document' || field.confirmed) return null;
  if (correcting && onSettle) return <CorrectForm field={field} onCancel={() => setCorrecting(false)} onSave={(value) => void onSettle(field.key, value).then(() => setCorrecting(false))} />;
  return (
    <View className="mt-1">
      <View className="flex-row"><Pill tone="warn" testID={`por-confirmar-${field.key}`}>Leído del documento · por confirmar</Pill></View>
      {onSettle ? (
        <View className="flex-row">
          <TextButton testID={`confirmar-${field.key}`} onPress={() => void onSettle(field.key)}>Confirmar</TextButton>
          <TextButton testID={`corregir-${field.key}`} tone="neutral" onPress={() => setCorrecting(true)}>Corregir</TextButton>
        </View>
      ) : null}
    </View>
  );
}

export function DocumentFieldRow({ field, first, onSettle }: { field: ProspectField; first: boolean; onSettle?: SettleField }) {
  return (
    <View className={`py-2 ${first ? 'mt-1' : 'border-t border-outline/10'}`}>
      <Text className="text-[12px] text-on-surface-variant">{field.label}</Text>
      <Text className="text-[15px] font-semibold text-on-surface">{field.value}</Text>
      <Settlement field={field} onSettle={onSettle} />
      {field.geo ? <FieldGeoMap geo={field.geo} testID={`mapa-dato-${field.key}`} /> : null}
    </View>
  );
}
