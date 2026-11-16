import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { CheckCircle2, RotateCcw } from 'lucide-react-native';
import { AREA_METHOD_LABELS, areaCreateRequest, arAreaFigures, arPerimeterM, arShotLabels, arShotPanel, arSummaryChips, arMethodOf, arAreaOf, arDiagonalRows, arProblemLine, isArWarning, type AreaDocument, zoneGeometryField } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader, SectionTitle } from '../observations/ObservationParts';
import type { ObservationTarget } from '../observations/useObservations';
import type { ArMeasured } from './ArMeasureScreen';
import { ArPlanCard } from './ArPlanCard';
import { useAreaWrite } from './useAreas';
import { PlaceCard, ResultCard, ThicknessCard, usePlaceText, useReadings, useReveal, useZoneShot } from './ZoneParts';
import { ProblemsCard, SidesCard, useSideTapes } from './ZoneSides';
import type { ZonePlace } from './useZonePlace';
import { withShotLabels, type CapturedEvidence } from '../useDriveUpload';

type Props = { to: ObservationTarget; report: AreaDocument | null; zone: number; measured: ArMeasured; evidence: CapturedEvidence | null; place: ZonePlace; onRemeasure: () => void; onBack: () => void; onSaved: (reportId: string) => void };

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
  const tape = useSideTapes();
  const thickness = useReadings();
  const { points, stable } = props.measured;
  const result = useMemo(() => arAreaOf({ points, tapes: tape.tapes, diagonals: tape.list, readingsCm: thickness.readings, stable }), [points, stable, tape.tapes, tape.list, thickness.readings]);
  const typing = tape.editing !== null || thickness.editing;
  const write = useAreaWrite(props.to);
  const reveal = useReveal();
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
    if (typing || blocker || !result.canSave || !shot.shot) return;
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
          <SidesCard sides={result.sides} rows={arDiagonalRows(result)} tape={tape} onShown={reveal.show} />
          <ThicknessCard readings={thickness.readings} thicknessCm={result.thicknessCm} editing={thickness.editing} typed={thickness.typed} onAdd={thickness.add} onRemove={thickness.remove} onType={thickness.type} onDone={thickness.done} error={thickness.error} />
          {result.areaM2 !== null ? <ResultCard line={arAreaFigures(result).line} method={AREA_METHOD_LABELS[arMethodOf(result)]} chips={chips} /> : null}
          {result.problems.length ? <ProblemsCard problems={result.problems} /> : null}
          {shot.message ? <Text className="text-[13px] text-error">{shot.message}</Text> : null}
          <Pressable testID="volver-a-medir" onPress={props.onRemeasure} className="h-12 flex-row items-center justify-center gap-2"><RotateCcw size={18} color={colors.primary} /><Text className="text-[15px] font-semibold text-primary">Volver a medir con AR</Text></Pressable>
          {write.line ? <Text testID="area-escritura" className="text-center text-[13px] text-on-surface-variant">{write.line}</Text> : null}
        </View>
      </ScrollView>
      {/* While a measure is typed, its own «Listo» is the only button (José 15/11: two big buttons at once). */}
      {typing ? null : <BottomAction testID="guardar-zona" label="Guardar zona" icon={<CheckCircle2 size={22} color={colors['on-primary']} />} busy={write.busy} note={blocker ?? (props.report?.code ? `Se sumará al informe ${props.report.code}` : null)} onPress={() => (blocker ? undefined : void save())} />}
    </View>
  );
}
