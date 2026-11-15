import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, Delete } from 'lucide-react-native';
import type { TapeKey } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const ROWS: TapeKey[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'borrar']];

/** Design la-05: the tape's own keypad, 56 px keys (gloves, sun), and «Listo». */
export function TapeKeypad(props: { title: string; typed: string; unit: 'm' | 'cm'; onKey: (key: TapeKey) => void; onDone: () => void; onShown?: (node: View) => void }) {
  const colors = useColores();
  const box = useRef<View>(null);
  const shown = useRef(false);
  /** After its first layout, once, so the keypad has its height when it is measured. */
  const reveal = () => {
    if (shown.current || !box.current) return;
    shown.current = true;
    props.onShown?.(box.current);
  };
  return (
    <View ref={box} onLayout={reveal} testID="teclado-wincha" className="gap-2 rounded-2xl border border-primary/40 bg-surface p-3">
      <Text className="text-[15px] font-bold text-primary">{props.title}</Text>
      <View className="flex-row items-baseline justify-between rounded-xl border-[1.5px] border-primary px-4 py-3">
        <Text className="text-[14px] text-on-surface-variant">{props.unit === 'm' ? 'Valor wincha:' : 'Lectura:'}</Text>
        <Text testID="valor-wincha" className="text-[28px] font-extrabold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{props.typed || '0'}<Text className="text-[16px] text-primary">{` ${props.unit}`}</Text></Text>
      </View>
      {ROWS.map((row) => (
        <View key={row.join('')} className="flex-row gap-2">
          {row.map((key) => (
            <Pressable key={key} testID={`tecla-${key}`} onPress={() => props.onKey(key)} accessibilityLabel={key === 'borrar' ? 'Borrar' : key} className="h-14 flex-1 items-center justify-center rounded-xl border border-outline/20 bg-background">
              {key === 'borrar' ? <Delete size={22} color={colors['on-surface']} /> : <Text className="text-[22px] font-semibold text-on-surface">{key}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable testID="wincha-listo" onPress={props.onDone} className="h-14 flex-row items-center justify-center gap-2 rounded-xl bg-primary">
        <Check size={20} color={colors['on-primary']} />
        <Text className="text-[17px] font-bold text-on-primary">Listo</Text>
      </Pressable>
    </View>
  );
}
