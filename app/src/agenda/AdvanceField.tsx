import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { advanceChips, advanceShort, advanceToMinutes, ADVANCE_FULL_TEXT, ADVANCE_INVALID_TEXT, MAX_ADVANCES, toggleAdvance, type AdvanceUnit } from '@lilachat/shared';
import { useColores } from '../ui/tema';

const UNITS: { value: AdvanceUnit; label: string }[] = [
  { value: 'min', label: 'min' },
  { value: 'h', label: 'horas' },
  { value: 'dia', label: 'días' },
];

/**
 * «Avisar antes» of a reminder (José 25/10): the usual advances as chips — several can be on at once —
 * and «Otro…» for a custom amount. The same as the web's (`AdvanceFieldWeb`); the rules live in
 * `reminderAdvance` (shared, tested).
 */
export function AdvanceField(props: { value: number[]; onChange: (next: number[]) => void }) {
  const colors = useColores();
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<AdvanceUnit>('min');
  const [error, setError] = useState('');

  const addCustom = () => {
    const minutes = advanceToMinutes(Number(amount), unit);
    if (minutes === null || amount.trim() === '') return setError(ADVANCE_INVALID_TEXT);
    if (props.value.length >= MAX_ADVANCES && !props.value.includes(minutes)) return setError(ADVANCE_FULL_TEXT);
    setError('');
    if (!props.value.includes(minutes)) props.onChange(toggleAdvance(props.value, minutes));
    setAmount('');
    setCustom(false);
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {advanceChips(props.value).map((minutes) => {
          const on = props.value.includes(minutes);
          return (
            <Pressable
              key={minutes}
              testID={`aviso-${minutes}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => props.onChange(toggleAdvance(props.value, minutes))}
              className={`min-h-[44px] items-center justify-center rounded-full border px-4 ${on ? 'border-primary bg-primary/10' : 'border-outline/25 bg-primary/[0.04]'}`}
            >
              <Text className={`text-[14px] font-medium ${on ? 'text-primary' : 'text-on-surface-variant'}`}>{advanceShort(minutes)}</Text>
            </Pressable>
          );
        })}
        <Pressable testID="aviso-otro" accessibilityRole="button" accessibilityState={{ expanded: custom }} onPress={() => setCustom((before) => !before)} className="min-h-[44px] items-center justify-center rounded-full border border-dashed border-outline/40 px-4">
          <Text className="text-[14px] font-medium text-primary">Otro…</Text>
        </Pressable>
      </View>
      {custom ? (
        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            testID="aviso-otro-cantidad"
            value={amount}
            onChangeText={(text) => {
              setAmount(text.replace(/\D/g, ''));
              setError('');
            }}
            keyboardType="number-pad"
            placeholder="30"
            placeholderTextColor={colors['on-surface-variant']}
            accessibilityLabel="Cantidad de tiempo antes"
            className="h-11 w-20 rounded-xl bg-primary/[0.07] px-3 text-base text-on-surface"
          />
          {UNITS.map((one) => (
            <Pressable key={one.value} testID={`aviso-otro-unidad-${one.value}`} accessibilityRole="button" accessibilityState={{ selected: unit === one.value }} onPress={() => setUnit(one.value)} className={`h-11 items-center justify-center rounded-xl px-3 ${unit === one.value ? 'bg-primary' : 'bg-primary/[0.07]'}`}>
              <Text className={`text-[14px] font-medium ${unit === one.value ? 'text-on-primary' : 'text-on-surface-variant'}`}>{one.label}</Text>
            </Pressable>
          ))}
          <Pressable testID="aviso-otro-agregar" accessibilityRole="button" onPress={addCustom} className="h-11 items-center justify-center rounded-xl border border-primary px-3">
            <Text className="text-[14px] font-semibold text-primary">Agregar</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text testID="aviso-error" className="mt-2 text-[12px] text-error">
          {error}
        </Text>
      ) : null}
      <Text className="mt-2 text-[12px] text-on-surface-variant">{props.value.length === 0 ? 'Sin aviso previo: solo suena a la hora.' : 'Suena antes y también a la hora.'}</Text>
    </View>
  );
}
