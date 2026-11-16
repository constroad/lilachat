import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react-native';
import { AREA_METHOD_LABELS, areaCreateRequest, arAreaFigures, arPerimeterM, arShotLabels, arShotPanel, arSummaryChips, arMethodOf, arAreaOf, arDiagonalRows, arProblemLine, isArWarning, isThicknessReading, readingTyped, tapeKey, tapeMeters, THICKNESS_OUT_OF_RANGE, type ArDiagonalRow, type ArProblem, type ArSide, type AreaDocument, type TapeKey, zoneGeometryField } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader, SectionTitle } from '../observations/ObservationParts';
import type { ObservationTarget } from '../observations/useObservations';
import type { ArMeasured } from './ArMeasureScreen';
import { ArPlanCard } from './ArPlanCard';
import { TapeKeypad } from './TapeKeypad';
import { useAreaWrite } from './useAreas';
import { decimals, PlaceCard, ResultCard, ThicknessCard, usePlaceText, useReveal, useZoneShot } from './ZoneParts';
import type { ZonePlace } from './useZonePlace';
import { withShotLabels, type CapturedEvidence } from '../useDriveUpload';

type Editing = { kind: 'side'; index: number } | { kind: 'diagonal'; to: number } | { kind: 'reading' } | null;
type Props = { to: ObservationTarget; report: AreaDocument | null; zone: number; measured: ArMeasured; evidence: CapturedEvidence | null; place: ZonePlace; onRemeasure: () => void; onBack: () => void; onSaved: (reportId: string) => void };

/** The tape on each side and the thickness readings; the engine turns them and the AR's corners into the figures. */
function useTape(measured: ArMeasured) {
  const [tapes, setTapes] = useState<Record<number, number>>({});
  // A diagonal goes from corner A to `to` (the fan `arDiagonalRows` offers).
  const [diagonals, setDiagonals] = useState<Record<number, number>>({});
  const [readings, setReadings] = useState<number[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [typed, setTyped] = useState('');
  const [readingError, setReadingError] = useState<string | null>(null);
  const result = useMemo(() => arAreaOf({
    points: measured.points, tapes, readingsCm: readings, stable: measured.stable,
    diagonals: Object.entries(diagonals).map(([to, meters]) => ({ from: 0, to: Number(to), meters })),
  }), [measured, tapes, diagonals, readings]);
  const open = (next: Editing) => { setEditing(next); setTyped(typedOf(next, tapes, diagonals)); };
  const done = () => {
    const value = tapeMeters(typed);
    if (editing?.kind === 'reading' && value !== null && !isThicknessReading(value)) return setReadingError(THICKNESS_OUT_OF_RANGE);
    if (editing?.kind === 'side') setTapes((current) => withTape(current, editing.index, value));
    if (editing?.kind === 'diagonal') setDiagonals((current) => withTape(current, editing.to, value));
    if (editing?.kind === 'reading' && value !== null) setReadings((current) => [...current, value]);
    setReadingError(null);
    setEditing(null);
  };
  return { result, readings, setReadings, editing, typed, readingError, open, done, key: (pressed: TapeKey) => setTyped((current) => tapeKey(current, pressed)), type: (text: string) => setTyped(readingTyped(text)) };
}

/** What the keypad opens with: the tape already on that side or diagonal. */
function typedOf(editing: Editing, tapes: Record<number, number>, diagonals: Record<number, number>): string {
  const meters = editing?.kind === 'side' ? tapes[editing.index] : editing?.kind === 'diagonal' ? diagonals[editing.to] : undefined;
  return meters ? String(meters) : '';
}

/** An empty «Listo» takes the tape off that side: the AR length goes back. */
function withTape(current: Record<number, number>, index: number, value: number | null): Record<number, number> {
  const next = { ...current };
  if (value === null) delete next[index];
  else next[index] = value;
  return next;
}

/**
 * Design la-03 (José 15/11, «AR + wincha»): the plan the AR drew, each side
 * with its AR length and, when taped, the tape (which wins), the thickness and
 * the result. The save button works only when the engine finds nothing wrong: at
 * least one taped side, every tape within 15 %, the corners neither crossed nor lifted.
 */
export function ArZoneScreen(props: Props) {
  const colors = useColores();
  const [entryId] = useState(() => Crypto.randomUUID());
  const [note, setNote] = useState('');
  const shot = useZoneShot(props.evidence);
  const placeText = usePlaceText(props.place.place);
  const tape = useTape(props.measured);
  const write = useAreaWrite(props.to);
  const reveal = useReveal();
  const { result } = tape;
  // Only a real fault stops the save: no tape and a corner off the floor only warn (José 15/11).
  const fault = result.problems.find((problem) => !isArWarning(problem));
  // The meters go on the AR's own frame only: a photo retaken with the camera has no corners (José 15/11).
  const frameShot = shot.shot && shot.shot === props.evidence ? props.measured.shot : undefined;
  const labels = frameShot ? arShotLabels(frameShot.corners, frameShot, result.sides) : [];
  // The figures go in a corner, never inside the zone (José 15/11, like his reference app).
  const panel = frameShot && result.areaM2 !== null ? arShotPanel({ areaM2: result.areaM2, perimeterM: arPerimeterM(result.sides) }) : [];
  const chips = result.areaM2 !== null ? arSummaryChips({ areaM2: result.areaM2, volumeM3: result.volumeM3, perimeterM: arPerimeterM(result.sides), sides: result.sides.length }) : [];
  const blocker = !shot.shot ? 'Toma la foto de la zona.' : fault ? arProblemLine(fault) : null;
  const save = async () => {
    if (tape.editing || blocker || !result.canSave || !shot.shot) return;
    const gps = props.place.point ?? shot.point;
    const point = gps ? { lat: gps.lat, lng: gps.lng, precision: gps.precision } : null;
    const reportId = await write.save(areaCreateRequest(props.report, entryId, arAreaFigures(result), point, arMethodOf(result), 'apk', zoneGeometryField(result)), { place: placeText.value.trim(), note }, [withShotLabels(shot.shot, labels, panel)]);
    if (reportId) props.onSaved(reportId);
  };
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={`${props.report?.code ?? 'IAA'} · Zona ${props.zone}`} title={placeText.value || `Zona ${props.zone}`} onBack={props.onBack} />
      <ScrollView ref={reveal.scroll} onLayout={reveal.onLayout} testID="zona-ar-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View ref={reveal.content} collapsable={false} className="gap-3">
          <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
            <SectionTitle title="Descripción" side="Opcional" />
            <TextInput testID="area-descripcion" value={note} onChangeText={setNote} placeholder="Bacheo localizado" placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] rounded-xl border border-outline/20 px-3 text-[15px] text-on-surface" />
          </View>
          <PlaceCard value={placeText.value} asking={props.place.asking} fromGps={Boolean(props.place.place) && !placeText.typed} onChange={placeText.set} />
          <ArPlanCard points={props.measured.points} sides={result.sides} diagonals={arDiagonalRows(result).filter((row) => row.taped || (tape.editing?.kind === 'diagonal' && tape.editing.to === row.to))} editing={tape.editing?.kind === 'side' ? tape.editing.index : null} photo={shot.shot?.preview.uri ?? null} labels={labels} panel={panel} onRetake={() => void shot.take()} />
          <SidesCard tape={tape} onShown={reveal.show} />
          <ThicknessCard readings={tape.readings} thicknessCm={result.thicknessCm} editing={tape.editing?.kind === 'reading'} typed={tape.typed} onAdd={() => tape.open({ kind: 'reading' })} onRemove={(index) => tape.setReadings((current) => current.filter((_, at) => at !== index))} onType={tape.type} onDone={tape.done} error={tape.readingError} />
          {result.areaM2 !== null ? <ResultCard line={arAreaFigures(result).line} method={AREA_METHOD_LABELS[arMethodOf(result)]} chips={chips} /> : null}
          {result.problems.length ? <ProblemsCard problems={result.problems} /> : null}
          {shot.message ? <Text className="text-[13px] text-error">{shot.message}</Text> : null}
          <Pressable testID="volver-a-medir" onPress={props.onRemeasure} className="h-12 flex-row items-center justify-center gap-2"><RotateCcw size={18} color={colors.primary} /><Text className="text-[15px] font-semibold text-primary">Volver a medir con AR</Text></Pressable>
          {write.line ? <Text testID="area-escritura" className="text-center text-[13px] text-on-surface-variant">{write.line}</Text> : null}
        </View>
      </ScrollView>
      {/* While a measure is typed, its own «Listo» is the only button (José 15/11: two big buttons at once). */}
      {tape.editing ? null : <BottomAction testID="guardar-zona" label="Guardar zona" icon={<CheckCircle2 size={22} color={colors['on-primary']} />} busy={write.busy} note={blocker ?? (props.report?.code ? `Se sumará al informe ${props.report.code}` : null)} onPress={() => (blocker ? undefined : void save())} />}
    </View>
  );
}

type Tape = ReturnType<typeof useTape>;

/** «Lados · toca uno para poner la wincha»: each side's length, where it comes from, and the tape's keypad. */
function SidesCard({ tape, onShown }: { tape: Tape; onShown: (node: View) => void }) {
  const editing = tape.editing?.kind === 'side' ? tape.editing.index : null;
  return (
    <View className="gap-1 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Lados · toca uno para poner la wincha" />
      {tape.result.sides.map((side) => (editing === side.index
        ? <View key={side.index} className="gap-2"><SideWarning side={side} /><TapeKeypad title={`Lado ${side.index + 1} en edición`} unit="m" before={`AR ${decimals(side.arMeters, 2)} m`} typed={tape.typed} onKey={tape.key} onDone={tape.done} onShown={onShown} /></View>
        : <SideRow key={side.index} side={side} onPress={() => tape.open({ kind: 'side', index: side.index })} />))}
      <DiagonalRows tape={tape} onShown={onShown} />
    </View>
  );
}

/**
 * José 16/11: a street zone is rarely a triangle. A quad's four sides do not fix its shape (it
 * flexes); one diagonal from corner A does, and then the area comes from the tapes alone.
 */
function DiagonalRows({ tape, onShown }: { tape: Tape; onShown: (node: View) => void }) {
  const rows = arDiagonalRows(tape.result);
  if (!rows.length) return null;
  const editing = tape.editing?.kind === 'diagonal' ? tape.editing.to : null;
  return (
    <View testID="diagonales-ar" className="gap-1 pt-3">
      <SectionTitle title="Diagonales · fijan la forma" side="Opcional" />
      {rows.map((row) => (editing === row.to
        ? <TapeKeypad key={row.to} title={`${row.label} en edición`} unit="m" before={`AR ${decimals(row.arMeters, 2)} m`} typed={tape.typed} onKey={tape.key} onDone={tape.done} onShown={onShown} />
        : <DiagonalRow key={row.to} row={row} onPress={() => tape.open({ kind: 'diagonal', to: row.to })} />))}
    </View>
  );
}

function DiagonalRow({ row, onPress }: { row: ArDiagonalRow; onPress: () => void }) {
  const colors = useColores();
  const warning = !row.taped || row.flag === 'ok' ? null : row.centimeters ? '¿Escribiste centímetros? La wincha va en metros (2,30 y no 230).' : row.flag === 'block' ? `La wincha difiere más de 15 % del AR (${decimals(row.arMeters, 2)} m): revisa las esquinas.` : 'AR y wincha no coinciden · manda la wincha';
  return (
    <View className="border-b border-outline/10 py-1">
      <Pressable testID={`diagonal-ar-${row.to + 1}`} onPress={onPress} className="min-h-[52px] flex-row items-center gap-3">
        <Text className="flex-1 text-[15px] text-on-surface">{row.label}</Text>
        <Text className="text-[16px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{`${decimals(row.meters, 2)} m`}</Text>
        <Text className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${row.flag === 'block' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{row.taped ? 'Wincha' : 'AR'}</Text>
      </Pressable>
      {warning ? <View className="mb-1 flex-row items-center gap-2 rounded-xl border border-error/30 bg-error/5 p-2"><AlertTriangle size={16} color={colors.error} /><Text className="flex-1 text-[13px] font-semibold text-error">{warning}</Text></View> : null}
    </View>
  );
}

function SideRow({ side, onPress }: { side: ArSide; onPress: () => void }) {
  const taped = side.source === 'wincha';
  return (
    <View className="border-b border-outline/10 py-1">
      <Pressable testID={`lado-ar-${side.index + 1}`} onPress={onPress} className="min-h-[52px] flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full border border-outline/30"><Text className="text-[13px] font-bold text-on-surface">{side.index + 1}</Text></View>
        <Text className="flex-1 text-[15px] text-on-surface">{`Lado ${side.index + 1}`}</Text>
        <Text className="text-[16px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{`${decimals(side.meters, 2)} m`}</Text>
        <Text className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${side.flag === 'block' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{taped ? (side.flag === 'ok' ? 'Wincha' : 'Ajustado') : 'AR'}</Text>
      </Pressable>
      <SideWarning side={side} />
    </View>
  );
}

/** José 15/11: over 3 % «manda la wincha»; over 15 % it does not save (or it was typed in centimeters). */
function SideWarning({ side }: { side: ArSide }) {
  const colors = useColores();
  if (side.source !== 'wincha' || side.flag === 'ok') return null;
  const line = side.centimeters ? '¿Escribiste centímetros? La wincha va en metros (2,30 y no 230).' : side.flag === 'block' ? `La wincha difiere más de 15 % del AR (${decimals(side.arMeters, 2)} m): revisa que sea este lado.` : 'AR y wincha no coinciden · manda la wincha';
  return (
    <View testID={`aviso-lado-${side.index + 1}`} className="mb-1 flex-row items-center gap-2 rounded-xl border border-error/30 bg-error/5 p-2">
      <AlertTriangle size={16} color={colors.error} />
      <Text className="flex-1 text-[13px] font-semibold text-error">{line}</Text>
    </View>
  );
}

/** A fault in red stops the save; a warning in amber only asks to look (José 15/11). */
function ProblemsCard({ problems }: { problems: readonly ArProblem[] }) {
  const faults = problems.filter((problem) => !isArWarning(problem));
  const warnings = problems.filter(isArWarning);
  return (
    <View className="gap-2">
      {faults.length ? <View testID="problemas-ar" className="gap-1 rounded-2xl border border-error/30 bg-error/5 p-3">{faults.map((problem) => <Text key={problem} className="text-[14px] text-on-surface">{`• ${arProblemLine(problem)}`}</Text>)}</View> : null}
      {warnings.length ? <View testID="avisos-ar" className="gap-1 rounded-2xl border border-warning/40 bg-warning/10 p-3">{warnings.map((problem) => <Text key={problem} className="text-[14px] text-on-surface">{`• ${arProblemLine(problem)}`}</Text>)}</View> : null}
    </View>
  );
}
