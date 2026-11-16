import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Trash2, X } from 'lucide-react-native';
import { AREA_METHOD_LABELS, arDiagonalRows, areaEditRequest, isArWarning, savedTapesOf, zoneChipsOf, zoneCorrectionOf, zoneRemoveAsk, type AdditionalArea, type AreaDocument, type ZoneGeometry } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader, SectionTitle } from '../observations/ObservationParts';
import type { ObservationTarget } from '../observations/useObservations';
import { WholePhoto } from './ArPlanCard';
import { useAreaEdit } from './useAreas';
import { decimals, ResultCard, ThicknessCard, useReadings } from './ZoneParts';
import { ProblemsCard, SidesCard, useSideTapes } from './ZoneSides';

type RemoveResult = { ok: boolean; message: string };
type Props = { to: ObservationTarget; report: AreaDocument; area: AdditionalArea; number: number; onRemove: (areaId: string) => Promise<RemoveResult>; onBusy: (busy: boolean) => void; onBack: () => void; onSaved: () => void };

/** «4,81 m² · 0,250 m³» with a thickness, or the area alone (m² by default, José 15/11). */
const resultLine = (areaM2: number, thicknessCm: number | null) => (thicknessCm === null ? `${decimals(areaM2, 2)} m²` : `${decimals(areaM2, 2)} m² · ${decimals((areaM2 * thicknessCm) / 100, 3)} m³`);
/** Portal keeps a text sent blank (audit 15/11): emptying one changes nothing, and the screen says so. */
const KEEPS_TEXT = 'En blanco se queda el texto guardado.';

/** One write at a time, between «Guardar cambios» and «Sí, borrar», and none twice (audit 15/11). */
function useOneWrite(onBusy: (busy: boolean) => void) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async <T,>(write: () => Promise<T>): Promise<T | null> => {
    if (running.current) return null;
    running.current = true;
    setBusy(true);
    onBusy(true);
    try {
      return await write();
    } finally {
      running.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  return { busy, run };
}

/** The saved thickness stays until a new reading replaces it or it is taken off (its readings are not kept). */
function useZoneThickness(saved: number | undefined) {
  const readings = useReadings();
  const [keepsSaved, setKeepsSaved] = useState(saved !== undefined);
  const kept = keepsSaved && saved !== undefined ? saved : null;
  return { readings, thicknessCm: readings.thicknessCm ?? kept, saved: readings.readings.length ? null : kept, dropSaved: () => setKeepsSaved(false) };
}

const NO_GEOMETRY: ZoneGeometry = { corners: [], sides: [], diagonals: [] };
/** A corrected side cannot be redrawn on the photo (its meters are burned in): the screen says so. */
const PHOTO_KEEPS_AR = 'La foto conserva las medidas del AR; el informe usa las corregidas.';

/**
 * José 16/11: a zone measured with the AR keeps its corners and tapes (Portal's `geometria`), so a
 * side is corrected with the tape after saving and the zone recomputed by the measure's own engine.
 */
function useZoneCorrection(area: AdditionalArea) {
  const geometry = area.geometry ?? NO_GEOMETRY;
  const [saved] = useState(() => savedTapesOf(geometry));
  const tape = useSideTapes(saved);
  const fix = useMemo(() => (area.geometry ? zoneCorrectionOf(area.geometry, tape.tapes, tape.diagonals) : null), [area.geometry, tape.tapes, tape.diagonals]);
  const changed = JSON.stringify({ tapes: tape.tapes, diagonals: tape.diagonals }) !== JSON.stringify(saved);
  const fault = changed ? fix?.solution.problems.find((problem) => !isArWarning(problem)) ?? null : null;
  return { geometry, tape, fix, changed, fault, correction: changed ? fix?.correction ?? undefined : undefined };
}

/** While a reading is typed, its card scrolls above the keyboard (the E2E of 15/11: the field sat under it). */
function useRevealOnKeyboard(editing: boolean) {
  const scroll = useRef<ScrollView>(null);
  const at = useRef(0);
  useEffect(() => {
    if (!editing) return undefined;
    const shown = Keyboard.addListener('keyboardDidShow', () => scroll.current?.scrollTo({ y: Math.max(0, at.current - 12), animated: true }));
    return () => shown.remove();
  }, [editing]);
  return { scroll, at };
}

/**
 * Design la-06 (José 15/11: «¿cómo edito o borro?»): a saved zone's description and place, its
 * photo, the thickness (only for m³), the result, «Borrar zona» with its confirmation in place
 * and «Guardar cambios». The area is the measure's: a wrong one is measured again.
 */
export function ZoneEditScreen(props: Props) {
  const colors = useColores();
  const { area } = props;
  const [note, setNote] = useState(area.description ?? '');
  const [place, setPlace] = useState(area.place ?? '');
  const thickness = useZoneThickness(area.thicknessCm);
  const edit = useAreaEdit(props.to);
  const write = useOneWrite(props.onBusy);
  const [confirming, setConfirming] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const zone = useZoneCorrection(area);
  const request = areaEditRequest(props.report, area, thickness.thicknessCm, zone.correction);
  const areaM2 = zone.correction?.areaM2 ?? area.areaM2;
  const typing = thickness.readings.editing || zone.tape.editing !== null;
  const photo = area.photos[0];
  const reveal = useRevealOnKeyboard(thickness.readings.editing);
  // The delete's confirmation opens at the bottom: its two buttons scroll into view (E2E 15/11: half hidden).
  useEffect(() => { if (confirming) setTimeout(() => reveal.scroll.current?.scrollToEnd({ animated: true }), 50); }, [confirming, reveal.scroll]);
  const save = async () => {
    if (!request || typing || zone.fault) return;
    const result = await write.run(() => edit(request, { place, note }));
    if (result?.ok) props.onSaved();
    else if (result) setLine(result.message);
  };
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={`Editar · ${props.report.code ?? 'IAA'} · Zona ${props.number}`} title={place || `Zona ${props.number}`} onBack={() => (write.busy ? undefined : props.onBack())} />
      <ScrollView ref={reveal.scroll} testID="zona-editar-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <TextCard title="Descripción" testID="zona-editar-descripcion" value={note} saved={area.description} placeholder="Bacheo localizado" onChange={setNote} />
        <TextCard title="Lugar" testID="zona-editar-lugar" value={place} saved={area.place} placeholder="Calle y número" onChange={setPlace} />
        {photo ? <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3"><SectionTitle title="Foto de la zona" /><WholePhoto uri={photo.url} testID="zona-editar-foto" />{zone.changed ? <Text testID="foto-medidas-ar" className="text-[12px] text-on-surface-variant">{PHOTO_KEEPS_AR}</Text> : null}</View> : null}
        {/* José 16/11: «no sé dónde colocar el espesor»: right under the photo, not after every side. */}
        {thickness.saved !== null ? <SavedThickness value={thickness.saved} onDrop={thickness.dropSaved} /> : null}
        <View onLayout={(event) => { reveal.at.current = event.nativeEvent.layout.y; }}>
        <ThicknessCard readings={thickness.readings.readings} thicknessCm={thickness.readings.thicknessCm} editing={thickness.readings.editing} typed={thickness.readings.typed} onAdd={thickness.readings.add} onRemove={thickness.readings.remove} onType={thickness.readings.type} onDone={thickness.readings.done} error={thickness.readings.error} />
        </View>
        {zone.fix ? <SidesCard sides={zone.fix.solution.sides} rows={arDiagonalRows({ plane: zone.geometry.corners, diagonals: zone.fix.solution.diagonals })} tape={zone.tape} onShown={() => undefined} /> : null}
        {zone.fix && zone.changed && zone.fix.solution.problems.length ? <ProblemsCard problems={zone.fix.solution.problems} /> : null}
        <ResultCard line={resultLine(areaM2, thickness.thicknessCm)} method={AREA_METHOD_LABELS[zone.correction?.method ?? area.method ?? 'ar'] ?? '—'} hint={zone.fix ? 'Se recalcula al cambiar una wincha o el espesor' : 'Se recalcula al cambiar el espesor'} chips={zoneChipsOf({ ...area, areaM2 }, thickness.thicknessCm)} />
        {!request ? <Text testID="zona-no-editable" className="text-[13px] text-on-surface-variant">{area.method === 'foto-medida' ? 'Esta zona se midió en la oficina: se corrige en el Portal.' : 'No se sabe cómo se midió esta zona: se corrige en el Portal.'}</Text> : null}
        {request ? <RemoveZone ask={zoneRemoveAsk(props.number, props.report.totals, area)} busy={write.busy} confirming={confirming} setConfirming={setConfirming} color={colors.error} onConfirm={() => write.run(() => props.onRemove(area.id))} /> : null}
        {line ? <Text testID="zona-editar-error" className="text-center text-[13px] font-semibold text-error">{line}</Text> : null}
      </ScrollView>
      {typing || confirming || !request ? null : <BottomAction testID="guardar-cambios-zona" label="Guardar cambios" icon={<CheckCircle2 size={22} color={colors['on-primary']} />} busy={write.busy} note={zone.fault ? 'Corrige las winchas antes de guardar.' : null} onPress={() => void save()} />}
    </View>
  );
}

function TextCard(props: { title: string; testID: string; value: string; saved?: string; placeholder: string; onChange: (text: string) => void }) {
  const colors = useColores();
  const emptied = Boolean(props.saved) && !props.value.trim();
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title={props.title} />
      <TextInput testID={props.testID} value={props.value} onChangeText={props.onChange} placeholder={props.saved ?? props.placeholder} placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] rounded-xl border border-outline/20 px-3 text-[15px] text-on-surface" />
      {emptied ? <Text className="text-[12px] text-on-surface-variant">{KEEPS_TEXT}</Text> : null}
    </View>
  );
}

/** The thickness saved with the zone: kept until a new reading replaces it, or taken off for m² only. */
function SavedThickness({ value, onDrop }: { value: number; onDrop: () => void }) {
  const colors = useColores();
  return (
    <View testID="espesor-guardado" className="flex-row items-center justify-between gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <Text className="flex-1 text-[14px] text-on-surface">{`Espesor guardado · ${decimals(value, 1)} cm`}</Text>
      <Pressable testID="quitar-espesor-guardado" onPress={onDrop} accessibilityLabel="Quitar el espesor guardado" className="h-11 flex-row items-center gap-1 px-2"><X size={16} color={colors.primary} /><Text className="text-[13px] font-semibold text-primary">Quitar</Text></Pressable>
    </View>
  );
}

/** la-06: «Borrar zona» in a maroon outline, and its confirmation in place, never a dialog. */
function RemoveZone(props: { ask: { title: string; hint: string }; busy: boolean; confirming: boolean; setConfirming: (value: boolean) => void; color: string; onConfirm: () => Promise<RemoveResult | null> }) {
  const [error, setError] = useState<string | null>(null);
  if (!props.confirming) {
    return (
      <Pressable testID="borrar-zona" onPress={() => props.setConfirming(true)} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-error/50">
        <Trash2 size={18} color={props.color} />
        <Text className="text-[15px] font-semibold text-error">Borrar zona</Text>
      </Pressable>
    );
  }
  const confirm = async () => {
    const result = await props.onConfirm();
    if (result && !result.ok) setError(result.message);
  };
  return (
    <View testID="borrar-zona-confirmar" className="gap-2 rounded-2xl border border-error/30 bg-error/5 p-4">
      <Text className="text-[16px] font-bold text-error">{props.ask.title}</Text>
      <Text className="text-[13px] text-on-surface-variant">{props.ask.hint}</Text>
      {error ? <Text className="text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable onPress={() => props.setConfirming(false)} disabled={props.busy} className="h-12 flex-1 items-center justify-center rounded-xl border border-outline/20 bg-surface"><Text className="text-[14px] font-semibold text-on-surface">Cancelar</Text></Pressable>
        <Pressable testID="borrar-zona-si" onPress={() => void confirm()} disabled={props.busy} className="h-12 flex-1 items-center justify-center rounded-xl bg-error"><Text className="text-[14px] font-bold text-background">{props.busy ? 'Borrando…' : 'Sí, borrar'}</Text></Pressable>
      </View>
    </View>
  );
}
