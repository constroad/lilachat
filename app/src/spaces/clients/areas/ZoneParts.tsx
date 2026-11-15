import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import type { TapeKey } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { SectionTitle } from '../observations/ObservationParts';
import { freshPoint } from '../../../chat/location/freshPoint';
import { captureEvidence, type CapturedEvidence } from '../useDriveUpload';
import { TapeKeypad } from './TapeKeypad';

type GpsPoint = Awaited<ReturnType<typeof freshPoint>>;

/** What the zone screens share (la-03 with AR, la-05 with the photo): the thickness and the keypad in view. */
export const decimals = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');
const REVEAL_MARGIN = 16;

/** The photo and the GPS, read together when the screen opens (§5-ter rule 2: the camera first). */
export function useZoneShot() {
  const [shot, setShot] = useState<CapturedEvidence | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [point, setPoint] = useState<GpsPoint>(null);
  const take = useCallback(async () => {
    setMessage(null);
    void freshPoint().then(setPoint);
    const taken = await captureEvidence('photo', 'Foto de la zona');
    if (taken && 'message' in taken) setMessage(taken.message);
    else if (taken) setShot(taken);
  }, []);
  useEffect(() => { void take(); }, [take]);
  return { shot, message, point, take };
}


/** The tape's keypad opens below the fold: the list scrolls until «Listo» shows. */
export function useReveal() {
  const scroll = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const viewport = useRef(0);
  const show = useCallback((node: View) => {
    if (!content.current) return;
    node.measureLayout(content.current, (_x, y, _width, height) => {
      scroll.current?.scrollTo({ y: Math.max(0, y + height - viewport.current + REVEAL_MARGIN), animated: true });
    }, () => undefined);
  }, []);
  return { scroll, content, show, onLayout: (event: { nativeEvent: { layout: { height: number } } }) => { viewport.current = event.nativeEvent.layout.height; } };
}

type ThicknessProps = {
  readings: readonly number[]; thicknessCm: number | null; editing: boolean; typed: string;
  onAdd: () => void; onRemove: (index: number) => void; onKey: (key: TapeKey) => void; onDone: () => void; onShown: (node: View) => void;
};

/** «Espesor · lecturas en cm»: each reading a chip that comes off with a touch, and their mean. */
export function ThicknessCard(props: ThicknessProps) {
  const colors = useColores();
  const count = props.readings.length;
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Espesor · lecturas en cm" />
      <View className="flex-row flex-wrap gap-2">
        {props.readings.map((reading, index) => (
          <Pressable key={`${reading}-${index}`} testID={`lectura-${index}`} onPress={() => props.onRemove(index)} accessibilityLabel={`Quitar ${reading} cm`} className="h-11 flex-row items-center gap-1.5 rounded-xl border border-outline/20 px-3">
            <Text className="text-[15px] font-bold text-on-surface">{decimals(reading, 1)}<Text className="text-[12px] font-normal text-on-surface-variant"> cm</Text></Text>
            <X size={14} color={colors.primary} />
          </Pressable>
        ))}
        <Pressable testID="agregar-lectura" onPress={props.onAdd} className="h-11 flex-row items-center gap-1 rounded-xl border border-primary/40 px-3"><Plus size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Lectura</Text></Pressable>
      </View>
      {props.editing ? <TapeKeypad title="Lectura de espesor" unit="cm" typed={props.typed} onKey={props.onKey} onDone={props.onDone} onShown={props.onShown} /> : null}
      {props.thicknessCm !== null ? <Text className="text-[14px] text-on-surface">{`Promedio: ${decimals(props.thicknessCm, 1)} cm (${count} ${count === 1 ? 'lectura' : 'lecturas'})`}</Text> : null}
    </View>
  );
}

/** «Resultado»: the area and the volume, and how they were measured. */
export function ResultCard({ line, method }: { line: string; method: string }) {
  return (
    <View testID="resultado-zona" className="gap-1 rounded-2xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Resultado</Text>
      <Text className="text-[28px] font-extrabold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{line}</Text>
      <Text className="self-start rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">{method}</Text>
    </View>
  );
}
