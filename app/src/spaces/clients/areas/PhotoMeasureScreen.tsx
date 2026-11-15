import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Camera, CheckCircle2, Plus, Undo2, X } from 'lucide-react-native';
import { areaCreateRequest, photoAreaFigures, photoAreaOf, tapeKey, tapeMeters, type AreaDocument, type PhotoPoint, type TapeKey } from '@lilachat/shared';
import { freshPoint } from '../../../chat/location/freshPoint';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader, SectionTitle } from '../observations/ObservationParts';
import { captureEvidence, type CapturedEvidence } from '../useDriveUpload';
import type { ObservationTarget } from '../observations/useObservations';
import { PhotoCorners } from './PhotoCorners';
import { TapeKeypad } from './TapeKeypad';
import { useAreaWrite } from './useAreas';

type Editing = { kind: 'side'; index: number } | { kind: 'reading' } | null;
type GpsPoint = Awaited<ReturnType<typeof freshPoint>>;
const decimals = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

/** The photo and the GPS, read together when the screen opens (§5-ter rule 2: the camera first). */
function useShot() {
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

/** What the zone is measured with: the corners on the photo, the sides with the tape and the thickness readings. */
function useMeasure() {
  const [points, setPoints] = useState<PhotoPoint[]>([]);
  const [measured, setMeasured] = useState<Record<number, number>>({});
  const [readings, setReadings] = useState<number[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [typed, setTyped] = useState('');
  const result = useMemo(() => photoAreaOf(points, measured, readings), [points, measured, readings]);
  const open = (next: Editing) => { setEditing(next); setTyped(next?.kind === 'side' && measured[next.index] ? String(measured[next.index]) : ''); };
  const done = () => {
    const value = tapeMeters(typed);
    if (editing?.kind === 'side' && value !== null) setMeasured((current) => ({ ...current, [editing.index]: value }));
    if (editing?.kind === 'reading' && value !== null) setReadings((current) => [...current, value]);
    setEditing(null);
  };
  const undo = () => { setPoints((current) => current.slice(0, -1)); setMeasured((current) => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) < points.length - 2))); };
  return { points, setPoints, measured, readings, setReadings, editing, typed, result, open, done, undo, key: (pressed: TapeKey) => setTyped((current) => tapeKey(current, pressed)), reset: () => { setPoints([]); setMeasured({}); } };
}

/**
 * Design la-05 (the APK without AR): the zone's photo from above, its corners
 * touched, the sides fixed with the tape on its own keypad, the thickness
 * readings and «Guardar zona». One measured side gives the scale.
 */
export function PhotoMeasureScreen(props: { to: ObservationTarget; report: AreaDocument | null; zone: number; onBack: () => void; onSaved: (reportId: string) => void }) {
  const colors = useColores();
  const [entryId] = useState(() => Crypto.randomUUID());
  const [note, setNote] = useState('');
  const shot = useShot();
  const measure = useMeasure();
  const write = useAreaWrite(props.to);
  const reveal = useReveal();
  const save = async () => {
    if (!measure.result || !shot.shot) return;
    const point = shot.point ? { lat: shot.point.lat, lng: shot.point.lng, precision: shot.point.precision } : null;
    const request = areaCreateRequest(props.report, entryId, photoAreaFigures(measure.result), point, 'a-mano', 'apk');
    const reportId = await write.save(request, { place: '', note }, [shot.shot]);
    if (reportId) props.onSaved(reportId);
  };
  const pending = !shot.shot ? 'Toma la foto de la zona desde arriba.' : measure.points.length < 3 ? 'Toca las esquinas sobre la foto.' : !measure.result ? 'Mide un lado con la wincha.' : null;
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={`${props.report?.code ?? 'IAA'} · Zona ${props.zone}`} title="Medir con foto + wincha" onBack={props.onBack} />
      <ScrollView ref={reveal.scroll} onLayout={reveal.onLayout} testID="medir-foto-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <View ref={reveal.content} collapsable={false} className="gap-3">
        <PhotoCard shot={shot} measure={measure} color={colors.primary} />
        {measure.points.length >= 3 ? <SidesCard measure={measure} onShown={reveal.show} /> : null}
        <ThicknessCard measure={measure} color={colors.primary} onShown={reveal.show} />
        {measure.result ? <ResultCard result={measure.result} /> : null}
        <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
          <SectionTitle title="Descripción" side="Opcional" />
          <TextInput testID="area-descripcion" value={note} onChangeText={setNote} placeholder="Bacheo localizado" placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] rounded-xl border border-outline/20 px-3 text-[15px] text-on-surface" />
        </View>
        {write.line ? <Text testID="area-escritura" className="text-center text-[13px] text-on-surface-variant">{write.line}</Text> : null}
        </View>
      </ScrollView>
      <BottomAction testID="guardar-zona" label="Guardar zona" icon={<CheckCircle2 size={22} color={colors['on-primary']} />} busy={write.busy} note={pending ?? (props.report?.code ? `Se sumará al informe ${props.report.code}` : null)} onPress={() => (pending ? undefined : void save())} />
    </View>
  );
}

type Measure = ReturnType<typeof useMeasure>;
const REVEAL_MARGIN = 16;

/** The tape's keypad opens below the fold: the list scrolls until «Listo» shows. */
function useReveal() {
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

function PhotoCard(props: { shot: ReturnType<typeof useShot>; measure: Measure; color: string }) {
  const { shot, measure } = props;
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <View className="flex-row items-center justify-between">
        <SectionTitle title="Foto de la zona" />
        <Pressable testID="repetir-foto" onPress={() => { measure.reset(); void shot.take(); }} className="h-11 flex-row items-center gap-1.5 px-2"><Camera size={16} color={props.color} /><Text className="text-[14px] font-semibold text-primary">{shot.shot ? 'Repetir foto' : 'Tomar foto'}</Text></Pressable>
      </View>
      {shot.shot ? <PhotoCorners uri={shot.shot.preview.uri} points={measure.points} sides={measure.result?.sides ?? []} onTouch={(point) => measure.setPoints((current) => [...current, point])} /> : <View className="h-40 items-center justify-center rounded-xl bg-surface-variant"><Text className="text-[14px] text-on-surface-variant">Sin foto todavía</Text></View>}
      {shot.message ? <Text className="text-[13px] text-error">{shot.message}</Text> : null}
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-[13px] text-on-surface-variant">Toca las esquinas sobre la foto. La wincha fija las medidas reales.</Text>
        {measure.points.length ? <Pressable testID="deshacer-esquina" onPress={measure.undo} className="h-11 flex-row items-center gap-1 px-2"><Undo2 size={16} color={props.color} /><Text className="text-[13px] font-semibold text-primary">Deshacer</Text></Pressable> : null}
      </View>
    </View>
  );
}

function SidesCard({ measure, onShown }: { measure: Measure; onShown: (node: View) => void }) {
  const editing = measure.editing?.kind === 'side' ? measure.editing.index : null;
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Lados · largo con wincha" />
      {measure.points.map((_, index) => {
        const side = measure.result?.sides[index];
        if (editing === index) return <TapeKeypad key={index} title={`Lado ${index + 1}`} unit="m" typed={measure.typed} onKey={measure.key} onDone={measure.done} onShown={onShown} />;
        return (
          <Pressable key={index} testID={`lado-${index + 1}`} onPress={() => measure.open({ kind: 'side', index })} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10">
            <View className="h-8 w-8 items-center justify-center rounded-full border border-outline/30"><Text className="text-[13px] font-bold text-on-surface">{index + 1}</Text></View>
            <Text className="flex-1 text-[15px] text-on-surface">{`Lado ${index + 1}`}</Text>
            <Text className="text-[16px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{side ? `${decimals(side.meters, 2)} m` : 'Medir'}</Text>
            {side ? <Text className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">{side.source === 'wincha' ? 'Wincha' : 'Escala'}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function ThicknessCard({ measure, color, onShown }: { measure: Measure; color: string; onShown: (node: View) => void }) {
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Espesor · lecturas en cm" />
      <View className="flex-row flex-wrap gap-2">
        {measure.readings.map((reading, index) => (
          <Pressable key={`${reading}-${index}`} testID={`lectura-${index}`} onPress={() => measure.setReadings((current) => current.filter((_, at) => at !== index))} accessibilityLabel={`Quitar ${reading} cm`} className="h-11 flex-row items-center gap-1.5 rounded-xl border border-outline/20 px-3">
            <Text className="text-[15px] font-bold text-on-surface">{decimals(reading, 1)}<Text className="text-[12px] font-normal text-on-surface-variant"> cm</Text></Text>
            <X size={14} color={color} />
          </Pressable>
        ))}
        <Pressable testID="agregar-lectura" onPress={() => measure.open({ kind: 'reading' })} className="h-11 flex-row items-center gap-1 rounded-xl border border-primary/40 px-3"><Plus size={16} color={color} /><Text className="text-[14px] font-semibold text-primary">Lectura</Text></Pressable>
      </View>
      {measure.editing?.kind === 'reading' ? <TapeKeypad title="Lectura de espesor" unit="cm" typed={measure.typed} onKey={measure.key} onDone={measure.done} onShown={onShown} /> : null}
      {measure.result?.thicknessCm !== null && measure.result?.thicknessCm !== undefined ? <Text className="text-[14px] text-on-surface">{`Promedio: ${decimals(measure.result.thicknessCm, 1)} cm (${measure.readings.length} ${measure.readings.length === 1 ? 'lectura' : 'lecturas'})`}</Text> : null}
    </View>
  );
}

function ResultCard({ result }: { result: NonNullable<Measure['result']> }) {
  const figures = photoAreaFigures(result);
  return (
    <View testID="resultado-zona" className="gap-1 rounded-2xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Resultado</Text>
      <Text className="text-[28px] font-extrabold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{figures.line}</Text>
      <Text className="self-start rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">Foto + wincha</Text>
    </View>
  );
}
