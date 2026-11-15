import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Trash2 } from 'lucide-react-native';
import { AREA_METHOD_LABELS, areaEditRequest, areaRemoveAsk, type AdditionalArea, type AreaDocument } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader, SectionTitle } from '../observations/ObservationParts';
import type { ObservationTarget } from '../observations/useObservations';
import { WholePhoto } from './ArPlanCard';
import { useAreaEdit } from './useAreas';
import { decimals, ResultCard, ThicknessCard, useReadings } from './ZoneParts';

type RemoveResult = { ok: boolean; message: string };
type Props = { to: ObservationTarget; report: AreaDocument; area: AdditionalArea; number: number; onRemove: (areaId: string) => Promise<RemoveResult>; onBack: () => void; onSaved: () => void };

/** «4,81 m² · 0,250 m³» with the thickness being typed, or the area alone (m² by default, José 15/11). */
const resultLine = (areaM2: number, thicknessCm: number | null) => (thicknessCm === null ? `${decimals(areaM2, 2)} m²` : `${decimals(areaM2, 2)} m² · ${decimals((areaM2 * thicknessCm) / 100, 3)} m³`);

/**
 * Design la-06 (José 15/11: «¿cómo edito o borro?»): a saved zone's photo, its description and
 * place, the thickness readings (only for m³), the result, «Borrar zona» with its confirmation in
 * place and «Guardar cambios». The area itself is the measure's: a wrong one is measured again.
 */
export function ZoneEditScreen(props: Props) {
  const colors = useColores();
  const { area } = props;
  const [note, setNote] = useState(area.description ?? '');
  const [place, setPlace] = useState(area.place ?? '');
  const readings = useReadings(area.thicknessCm !== undefined ? [area.thicknessCm] : []);
  const edit = useAreaEdit(props.to);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const request = areaEditRequest(props.report, area, readings.thicknessCm);
  const photo = area.photos[0];
  const save = async () => {
    if (!request || busy || readings.editing) return;
    setBusy(true);
    const result = await edit(request, { place, note });
    setBusy(false);
    if (result.ok) props.onSaved();
    else setLine(result.message);
  };
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={`Editar · ${props.report.code ?? 'IAA'} · Zona ${props.number}`} title={place || `Zona ${props.number}`} onBack={props.onBack} />
      <ScrollView testID="zona-editar-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <TextCard title="Descripción" testID="zona-editar-descripcion" value={note} placeholder="Bacheo localizado" onChange={setNote} />
        {photo ? <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3"><SectionTitle title="Foto de la zona" /><WholePhoto uri={photo.url} testID="zona-editar-foto" /></View> : null}
        <TextCard title="Lugar" testID="zona-editar-lugar" value={place} placeholder="Calle y número" onChange={setPlace} />
        <ThicknessCard readings={readings.readings} thicknessCm={readings.thicknessCm} editing={readings.editing} typed={readings.typed} onAdd={readings.add} onRemove={readings.remove} onType={readings.type} onDone={readings.done} error={readings.error} />
        <ResultCard line={resultLine(area.areaM2, readings.thicknessCm)} method={area.method ? AREA_METHOD_LABELS[area.method] : '—'} />
        {!request ? <Text testID="zona-no-editable" className="text-[13px] text-on-surface-variant">{area.method === 'foto-medida' ? 'Esta zona se midió en la oficina: se corrige en el Portal.' : 'No se sabe cómo se midió esta zona: se corrige en el Portal.'}</Text> : null}
        {request ? <RemoveZone area={area} number={props.number} onRemove={props.onRemove} color={colors.error} /> : null}
        {line ? <Text testID="zona-editar-error" className="text-center text-[13px] font-semibold text-error">{line}</Text> : null}
      </ScrollView>
      {readings.editing || !request ? null : <BottomAction testID="guardar-cambios-zona" label="Guardar cambios" icon={<CheckCircle2 size={22} color={colors['on-primary']} />} busy={busy} onPress={() => void save()} />}
    </View>
  );
}

function TextCard(props: { title: string; testID: string; value: string; placeholder: string; onChange: (text: string) => void }) {
  const colors = useColores();
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title={props.title} />
      <TextInput testID={props.testID} value={props.value} onChangeText={props.onChange} placeholder={props.placeholder} placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] rounded-xl border border-outline/20 px-3 text-[15px] text-on-surface" />
    </View>
  );
}

/** la-06: «Borrar zona» in a maroon outline, and its confirmation in place, never a dialog. */
function RemoveZone(props: { area: AdditionalArea; number: number; onRemove: (areaId: string) => Promise<RemoveResult>; color: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = areaRemoveAsk(props.area.item ?? String(props.number));
  if (!asking) {
    return (
      <Pressable testID="borrar-zona" onPress={() => setAsking(true)} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-error/50">
        <Trash2 size={18} color={props.color} />
        <Text className="text-[15px] font-semibold text-error">Borrar zona</Text>
      </Pressable>
    );
  }
  const confirm = async () => {
    setBusy(true);
    const result = await props.onRemove(props.area.id);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <View testID="borrar-zona-confirmar" className="gap-2 rounded-2xl border border-error/30 bg-error/5 p-4">
      <Text className="text-[16px] font-bold text-error">{ask.title}</Text>
      <Text className="text-[13px] text-on-surface-variant">{ask.hint}</Text>
      {error ? <Text className="text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable onPress={() => setAsking(false)} disabled={busy} className="h-12 flex-1 items-center justify-center rounded-xl border border-outline/20 bg-surface"><Text className="text-[14px] font-semibold text-on-surface">Cancelar</Text></Pressable>
        <Pressable testID="borrar-zona-si" onPress={() => void confirm()} disabled={busy} className="h-12 flex-1 items-center justify-center rounded-xl bg-error"><Text className="text-[14px] font-bold text-background">{busy ? 'Borrando…' : 'Sí, borrar'}</Text></Pressable>
      </View>
    </View>
  );
}
