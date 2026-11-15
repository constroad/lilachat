import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, MapPin, Plus, X } from 'lucide-react-native';
import { useColores } from '../../../ui/tema';
import { isThicknessReading, readingTyped, tapeMeters, thicknessAverage, THICKNESS_OUT_OF_RANGE } from '@lilachat/shared';
import { SectionTitle } from '../observations/ObservationParts';
import { freshPoint } from '../../../chat/location/freshPoint';
import { captureEvidence, type CapturedEvidence } from '../useDriveUpload';

type GpsPoint = Awaited<ReturnType<typeof freshPoint>>;

/** What the zone screens share (la-03 with AR, la-05 with the photo): the thickness and the keypad in view. */
export const decimals = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');
const REVEAL_MARGIN = 16;

/**
 * The photo and the GPS, read together when the screen opens (§5-ter rule 2: the camera first).
 * With the AR's own frame (`start`) the camera does not open: the zone was already marked.
 */
export function useZoneShot(start: CapturedEvidence | null = null) {
  const [shot, setShot] = useState<CapturedEvidence | null>(start);
  const [opensCamera] = useState(!start);
  const [message, setMessage] = useState<string | null>(null);
  const [point, setPoint] = useState<GpsPoint>(null);
  const take = useCallback(async () => {
    setMessage(null);
    void freshPoint().then(setPoint);
    const taken = await captureEvidence('photo', 'Foto de la zona');
    if (taken && 'message' in taken) setMessage(taken.message);
    else if (taken) setShot(taken);
  }, []);
  useEffect(() => { if (opensCamera) void take(); }, [opensCamera, take]);
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
  onAdd: () => void; onRemove: (index: number) => void; onType: (text: string) => void; onDone: () => void; error?: string | null;
};

/**
 * «Espesor · lecturas en cm» (design la-03): each reading a chip that comes off with a touch,
 * «+ Lectura» opens a small field with the phone's own number keyboard (José 15/11: the big
 * keypad here was not the design), and their mean.
 */
export function ThicknessCard(props: ThicknessProps) {
  const colors = useColores();
  const count = props.readings.length;
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      {/* José 15/11: the zone is m² by default; the thickness is only for m³. */}
      <SectionTitle title="Espesor · lecturas en cm" side={count ? undefined : 'Opcional · para m³'} />
      <View className="flex-row flex-wrap gap-2">
        {props.readings.map((reading, index) => (
          <Pressable key={`${reading}-${index}`} testID={`lectura-${index}`} onPress={() => props.onRemove(index)} accessibilityLabel={`Quitar ${reading} cm`} className="h-11 flex-row items-center gap-1.5 rounded-lg border border-outline/20 px-3">
            <Text className="text-[15px] font-bold text-on-surface">{decimals(reading, 1)}<Text className="text-[12px] font-normal text-on-surface-variant"> cm</Text></Text>
            <X size={14} color={colors.primary} />
          </Pressable>
        ))}
        {props.editing ? (
          <View className="h-11 flex-row items-center gap-1 rounded-lg border-[1.5px] border-primary pl-3">
            <TextInput testID="lectura-campo" autoFocus value={props.typed} onChangeText={props.onType} onSubmitEditing={props.onDone} keyboardType="decimal-pad" returnKeyType="done" placeholder="0,0" placeholderTextColor={colors['on-surface-variant']} className="w-16 text-[15px] font-bold text-on-surface" />
            <Text className="text-[12px] text-on-surface-variant">cm</Text>
            <Pressable testID="lectura-agregar" onPress={props.onDone} accessibilityLabel="Agregar lectura" className="h-11 w-11 items-center justify-center"><Check size={18} color={colors.primary} /></Pressable>
          </View>
        ) : (
          <Pressable testID="agregar-lectura" onPress={props.onAdd} className="h-11 flex-row items-center gap-1 rounded-lg border border-dashed border-primary/60 px-3"><Plus size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Lectura</Text></Pressable>
        )}
      </View>
      {props.error ? <Text testID="lectura-fuera-de-rango" className="text-[13px] font-semibold text-error">{props.error}</Text> : null}
      {props.thicknessCm !== null ? <Text className="text-[14px] font-semibold text-on-surface">{`Promedio ${decimals(props.thicknessCm, 1)} cm · ${count} ${count === 1 ? 'lectura' : 'lecturas'}`}</Text> : null}
    </View>
  );
}

/** The thickness readings alone (la-06 edits only them): typed, checked against Portal's range, averaged. */
export function useReadings(start: readonly number[] = []) {
  const [readings, setReadings] = useState<number[]>([...start]);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    const value = tapeMeters(typed);
    if (value !== null && !isThicknessReading(value)) return setError(THICKNESS_OUT_OF_RANGE);
    if (value !== null) setReadings((current) => [...current, value]);
    setError(null);
    setEditing(false);
  };
  return {
    readings, editing, typed, error, done, thicknessCm: thicknessAverage(readings),
    add: () => { setTyped(''); setEditing(true); },
    remove: (index: number) => setReadings((current) => current.filter((_, at) => at !== index)),
    type: (text: string) => setTyped(readingTyped(text)),
  };
}

/** «Resultado»: the area and the volume, and how they were measured. */
export function ResultCard({ line, method, hint }: { line: string; method: string; hint?: string }) {
  return (
    <View testID="resultado-zona" className="gap-1 rounded-2xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Resultado</Text>
        <Text className="rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">Calculado</Text>
      </View>
      <Text className="text-[28px] font-extrabold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{line}</Text>
      <Text className="self-start rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">{method}</Text>
      {hint ? <Text className="text-[13px] text-on-surface-variant">{hint}</Text> : null}
    </View>
  );
}

/** The zone's place as the GPS found it, editable; what the person types wins over a late answer. */
export function usePlaceText(found: string | null) {
  const [typed, setTyped] = useState<string | null>(null);
  return { value: typed ?? found ?? '', set: setTyped, typed: typed !== null };
}

/** «Lugar · Del GPS» (la-02's top bar, la-03's card): the street and station, or the address. */
export function PlaceCard(props: { value: string; asking: boolean; fromGps: boolean; onChange: (text: string) => void }) {
  const colors = useColores();
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Lugar" side={props.asking ? 'Buscando…' : props.fromGps ? 'Del GPS' : 'Escríbelo'} />
      <View className="flex-row items-center gap-2 rounded-xl border border-outline/20 px-3">
        <MapPin size={18} color={colors.primary} />
        <TextInput testID="area-lugar" value={props.value} onChangeText={props.onChange} placeholder="Calle y progresiva" placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] flex-1 text-[15px] text-on-surface" />
      </View>
    </View>
  );
}
