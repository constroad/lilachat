import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, Delete } from 'lucide-react-native';
import type { TapeKey } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const ROWS: TapeKey[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'borrar']];

/** Designs la-03/la-05: the tape's own keypad (48 px keys, the design's square ones), the AR's reading beside the value, and «Listo». */
export function TapeKeypad(props: { title: string; typed: string; unit: 'm' | 'cm'; before?: string; onKey: (key: TapeKey) => void; onDone: () => void; onShown?: (node: View) => void }) {
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
      <View className="flex-row items-center justify-between rounded-lg border border-outline/30 px-4 py-2">
        <Text testID="valor-wincha" className="text-[28px] font-extrabold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{props.typed || '0'}<Text className="text-[16px] text-on-surface-variant">{` ${props.unit}`}</Text></Text>
        {props.before ? <View className="items-end"><Text className="text-[11px] font-bold uppercase tracking-[1px] text-on-surface-variant">Lectura previa</Text><Text className="text-[13px] font-semibold text-on-surface-variant">{props.before}</Text></View> : null}
      </View>
      {ROWS.map((row) => (
        <View key={row.join('')} className="flex-row gap-2">
          {row.map((key) => (
            <Pressable key={key} testID={`tecla-${key}`} onPress={() => props.onKey(key)} accessibilityLabel={key === 'borrar' ? 'Borrar' : key} className="h-12 flex-1 items-center justify-center rounded-lg border border-outline/20 bg-background">
              {key === 'borrar' ? <Delete size={20} color={colors['on-surface']} /> : <Text className="text-[20px] font-semibold text-on-surface">{key}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable testID="wincha-listo" onPress={props.onDone} className="h-12 flex-row items-center justify-center gap-2 rounded-lg bg-primary">
        <Check size={20} color={colors['on-primary']} />
        <Text className="text-[17px] font-bold text-on-primary">Listo</Text>
      </Pressable>
    </View>
  );
}
