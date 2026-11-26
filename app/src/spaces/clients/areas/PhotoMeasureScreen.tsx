import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Camera, CheckCircle2, Undo2 } from 'lucide-react-native';
import { areaCreateRequest, isThicknessReading, photoAreaFigures, photoAreaOf, tapeKey, tapeMeters, THICKNESS_OUT_OF_RANGE, type AreaDocument, type PhotoPoint, type TapeKey, readingTyped } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader, SectionTitle } from '../observations/ObservationParts';
import type { ObservationTarget } from '../observations/useObservations';
import { PhotoCorners } from './PhotoCorners';
import { TapeKeypad } from './TapeKeypad';
import { decimals, PlaceCard, ResultCard, ThicknessCard, usePlaceText, useReveal, useZoneShot } from './ZoneParts';
import type { ZonePlace } from './useZonePlace';
import { useAreaWrite } from './useAreas';

type Editing = { kind: 'side'; index: number } | { kind: 'reading' } | null;

/** What the zone is measured with: the corners on the photo, the sides with the tape and the thickness readings. */
function useMeasure() {
  const [points, setPoints] = useState<PhotoPoint[]>([]);
  const [measured, setMeasured] = useState<Record<number, number>>({});
  const [readings, setReadings] = useState<number[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [typed, setTyped] = useState('');
  const [readingError, setReadingError] = useState<string | null>(null);
  const result = useMemo(() => photoAreaOf(points, measured, readings), [points, measured, readings]);
  const open = (next: Editing) => { setEditing(next); setTyped(next?.kind === 'side' && measured[next.index] ? String(measured[next.index]) : ''); };
  const done = () => {
    const value = tapeMeters(typed);
    if (editing?.kind === 'reading' && value !== null && !isThicknessReading(value)) return setReadingError(THICKNESS_OUT_OF_RANGE);
    setReadingError(null);
    if (editing?.kind === 'side' && value !== null) setMeasured((current) => ({ ...current, [editing.index]: value }));
    if (editing?.kind === 'reading' && value !== null) setReadings((current) => [...current, value]);
    setEditing(null);
  };
  const undo = () => { setPoints((current) => current.slice(0, -1)); setMeasured((current) => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) < points.length - 2))); };
  return { points, setPoints, measured, readings, setReadings, editing, typed, readingError, result, open, done, undo, key: (pressed: TapeKey) => setTyped((current) => tapeKey(current, pressed)), type: (text: string) => setTyped(readingTyped(text)), reset: () => { setPoints([]); setMeasured({}); } };
}

/**
 * Design la-05 (the APK without AR): the zone's photo from above, its corners
 * touched, the sides fixed with the tape on its own keypad, the thickness
 * readings and «Guardar zona». One measured side gives the scale.
 */
export function PhotoMeasureScreen(props: { to: ObservationTarget; report: AreaDocument | null; zone: number; place: ZonePlace; onBack: () => void; onSaved: (reportId: string) => void }) {
  const colors = useColores();
  const [entryId] = useState(() => Crypto.randomUUID());
  const [note, setNote] = useState('');
  const shot = useZoneShot();
  const placeText = usePlaceText(props.place.place);
  const measure = useMeasure();
  const write = useAreaWrite(props.to);
  const reveal = useReveal();
  const pending = !shot.shot ? 'Toma la foto de la zona desde arriba.' : measure.points.length < 3 ? 'Toca las esquinas sobre la foto.' : !measure.result ? 'Mide un lado con la wincha.' : null;
  const save = async () => {
    if (measure.editing || pending || !measure.result || !shot.shot) return;
    // The fix taken with the photo is this zone's; the measure's own read comes second (audit 15/11).
    const gps = shot.point ?? props.place.point;
    const point = gps ? { lat: gps.lat, lng: gps.lng, precision: gps.precision } : null;
    const request = areaCreateRequest(props.report, entryId, photoAreaFigures(measure.result), point, 'a-mano', 'apk');
    const reportId = await write.save(request, { place: placeText.value.trim(), note }, [shot.shot]);
    if (reportId !== null) props.onSaved(reportId);
  };
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={`${props.report?.code ?? 'IAA'} · Zona ${props.zone}`} title="Medir con foto + wincha" onBack={props.onBack} />
      <ScrollView ref={reveal.scroll} onLayout={reveal.onLayout} testID="medir-foto-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <View ref={reveal.content} collapsable={false} className="gap-3">
        <PhotoCard shot={shot} measure={measure} color={colors.primary} />
        {measure.points.length >= 3 ? <SidesCard measure={measure} onShown={reveal.show} /> : null}
        <ThicknessCard readings={measure.readings} thicknessCm={measure.result?.thicknessCm ?? null} editing={measure.editing?.kind === 'reading'} typed={measure.typed} onAdd={() => measure.open({ kind: 'reading' })} onRemove={(index) => measure.setReadings((current) => current.filter((_, at) => at !== index))} onType={measure.type} onDone={measure.done} error={measure.readingError} />
        <PlaceCard value={placeText.value} asking={props.place.asking} fromGps={Boolean(props.place.place) && !placeText.typed} onChange={placeText.set} />
        {measure.result ? <ResultCard line={photoAreaFigures(measure.result).line} method="Foto + wincha" /> : null}
        <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
          <SectionTitle title="Descripción" side="Opcional" />
          <TextInput testID="area-descripcion" value={note} onChangeText={setNote} placeholder="Bacheo localizado" placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] rounded-xl border border-outline/20 px-3 text-[15px] text-on-surface" />
        </View>
        {write.line ? <Text testID="area-escritura" className="text-center text-[13px] text-on-surface-variant">{write.line}</Text> : null}
        </View>
      </ScrollView>
      {measure.editing ? null : <BottomAction testID="guardar-zona" label="Guardar zona" icon={<CheckCircle2 size={22} color={colors['on-primary']} />} busy={write.busy} note={pending ?? (props.report?.code ? `Se sumará al informe ${props.report.code}` : null)} onPress={() => (pending ? undefined : void save())} />}
    </View>
  );
}

type Measure = ReturnType<typeof useMeasure>;
function PhotoCard(props: { shot: ReturnType<typeof useZoneShot>; measure: Measure; color: string }) {
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
