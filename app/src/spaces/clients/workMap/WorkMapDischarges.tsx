import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { CheckCircle2, SlidersHorizontal } from 'lucide-react-native';
import { usefulWidthLabel, confirmDischargeLabel, DISCHARGE_HOW, DISCHARGE_TITLE, dischargeExplain, dischargeGaps, dischargeHeadline, dischargeRowsOf, unitNumbers, metersLabel, progressEntryOf, stationLabel, stretchWorksOf, type DischargeRow, type DischargeSuggestion, type ProgressEntry, type StretchRange, type SuggestedStretch, type WorkMap } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

export type ProgressSend = (entry: ProgressEntry) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;

const KICKER = 'text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant';

function UnitRow(props: { row: DischargeRow }) {
  const { row } = props;
  const outside = row.state === 'outside';
  return (
    <View testID={`descarga-${row.dispatchId}`} className={`flex-row items-center gap-3 rounded-xl border bg-surface p-3 ${outside ? 'border-error/40' : 'border-outline/15'} ${row.state === 'noPlace' ? 'opacity-70' : ''}`}>
      <View className={`h-8 w-8 items-center justify-center rounded-full ${outside ? 'bg-error' : 'bg-primary'}`}>
        <Text className="text-[13px] font-bold text-on-primary">{row.number}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{row.title}</Text>
        <Text numberOfLines={1} className={`text-[13px] ${outside ? 'text-error' : 'text-on-surface-variant'}`}>{row.line}</Text>
      </View>
    </View>
  );
}

function RangeInputs(props: { range: StretchRange; onRange: (range: StretchRange) => void }) {
  const read = (value: string) => Number(value.replace(',', '.'));
  const input = 'min-h-[48px] rounded-xl border border-outline/20 bg-surface px-3 text-[15px] text-on-surface';
  return (
    <View className="flex-row gap-2">
      <View className="flex-1"><Text className="text-[13px] text-on-surface-variant">Desde (m)</Text><TextInput testID="avance-desde" keyboardType="decimal-pad" className={input} defaultValue={String(props.range.fromM)} onChangeText={(text) => props.onRange({ ...props.range, fromM: read(text) })} /></View>
      <View className="flex-1"><Text className="text-[13px] text-on-surface-variant">Hasta (m)</Text><TextInput testID="avance-hasta" keyboardType="decimal-pad" className={input} defaultValue={String(props.range.toM)} onChangeText={(text) => props.onRange({ ...props.range, toM: read(text) })} /></View>
    </View>
  );
}

function StretchCard(props: { map: WorkMap; serviceId: string; stretch: SuggestedStretch; send?: ProgressSend; range: StretchRange; onRange: (range: StretchRange) => void }) {
  const { map, stretch, range } = props;
  const colors = useColores();
  const works = stretchWorksOf(map, stretch.streetId);
  const [workId, setWorkId] = useState(works.length === 1 ? works[0]?.id : undefined);
  const [adjusting, setAdjusting] = useState(false);
  const [entryId] = useState(() => Crypto.randomUUID());
  const [answer, setAnswer] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const label = confirmDischargeLabel({ lengthM: range.toM - range.fromM });
  const confirm = async () => {
    const lengthM = map.streets.find((one) => one.id === stretch.streetId)?.lengthM ?? 0;
    const built = progressEntryOf({ serviceId: props.serviceId, stretch, ...range, work: works.find((one) => one.id === workId), entryId, now: new Date(), streetLengthM: lengthM });
    if (!built.ok || !props.send) return setAnswer({ ok: false, message: built.ok ? '' : built.message });
    setBusy(true);
    setAnswer(await props.send(built.entry));
    setBusy(false);
  };
  return (
    <View testID={`tramo-sugerido-${stretch.streetId}`} className="gap-2 rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className="text-[16px] font-semibold text-on-surface">{stretch.streetName}</Text>
      <Text className="text-[24px] font-bold text-on-surface">+{metersLabel(Math.max(0, range.toM - range.fromM))}</Text>
      <Text testID="avance-explica" className="mt-1 text-[14px] text-on-surface-variant">{dischargeExplain({ ...stretch, ...range })}</Text>
      <View className="flex-row flex-wrap gap-2">
        {works.map((work) => (
          <Pressable key={work.id} testID={`avance-trabajo-${work.id}`} accessibilityState={{ selected: workId === work.id }} onPress={() => setWorkId(work.id)} className={`min-h-[40px] flex-row items-center gap-1.5 rounded-full border px-3 ${workId === work.id ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />
            <Text className={`text-[14px] font-semibold ${workId === work.id ? 'text-on-primary' : 'text-on-surface'}`}>{work.name}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row rounded-xl border border-outline/15">
        <View className="flex-1 border-r border-outline/15 p-3"><Text className={KICKER}>Progresivas</Text><Text testID="avance-progresivas" className="text-[15px] font-semibold text-on-surface">{stationLabel(range.fromM)} a {stationLabel(range.toM)}</Text></View>
        <View className="flex-1 p-3"><Text className={KICKER}>Volumen</Text><Text className="text-[15px] font-semibold text-on-surface">{String(stretch.volumeM3).replace('.', ',')} m³</Text></View>
      </View>
      <View className="rounded-xl border border-outline/15 p-3"><Text className={KICKER}>Ancho útil</Text><Text testID="avance-ancho-util" className="text-[15px] font-semibold text-on-surface">{usefulWidthLabel(map, stretch.streetId, range)}</Text></View>
      {adjusting ? <RangeInputs range={range} onRange={props.onRange} /> : null}
      {props.send ? (
        <>
          <Pressable testID="avance-confirmar" disabled={busy || !label} onPress={() => void confirm()} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary ${busy || !label ? 'opacity-50' : ''}`}>
            <CheckCircle2 size={18} color={colors['on-primary']} /><Text className="text-[15px] font-semibold text-on-primary">{label ?? 'Ajusta el tramo para confirmar'}</Text>
          </Pressable>
          <Pressable testID="avance-ajustar" onPress={() => setAdjusting((shown) => !shown)} className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-outline/20">
            <SlidersHorizontal size={18} color={colors['on-surface']} /><Text className="text-[15px] font-semibold text-on-surface">Ajustar tramo</Text>
          </Pressable>
        </>
      ) : null}
      {answer ? <Text testID="avance-respuesta" accessibilityRole="alert" className={`text-[14px] ${answer.ok ? 'text-on-surface' : 'text-error'}`}>{answer.message}</Text> : null}
    </View>
  );
}

/** «Avance sugerido» (design `o-07-mapa-pista`): where the units emptied, as the stretch to confirm. Admins only. */
export function WorkMapDischarges(props: { map: WorkMap; serviceId: string; suggestion: DischargeSuggestion; send?: ProgressSend; ranges: Record<string, StretchRange>; onRange: (streetId: string, range: StretchRange) => void }) {
  const rows = useMemo(() => dischargeRowsOf(props.suggestion, unitNumbers(props.suggestion.units.map((one) => one.unit))), [props.suggestion]);
  return (
    <View testID="avance-sugerido" className="gap-3">
      <View className="gap-1">
        <Text className={KICKER}>Control de pista</Text>
        <Text className="text-[17px] font-semibold text-on-surface">{DISCHARGE_TITLE}</Text>
        <Text className="text-[13px] text-on-surface-variant">{DISCHARGE_HOW}</Text>
        <View className="mt-1 self-start rounded-full border border-primary/30 bg-primary/10 px-3 py-1"><Text testID="avance-listas" className="text-[12px] font-bold uppercase text-primary">{dischargeHeadline(props.suggestion)}</Text></View>
      </View>
      {dischargeGaps(props.suggestion) ? <Text testID="avance-sin-ubicar" className="rounded-xl border border-outline/15 bg-surface px-3 py-2 text-[13px] text-on-surface-variant">No suman: {dischargeGaps(props.suggestion)}.</Text> : null}
      {props.suggestion.stretches.map((stretch) => (
        <StretchCard key={stretch.streetId} map={props.map} serviceId={props.serviceId} stretch={stretch} send={props.send} range={props.ranges[stretch.streetId] ?? stretch} onRange={(range) => props.onRange(stretch.streetId, range)} />
      ))}
      <Text className={KICKER}>Descargas registradas ({rows.length})</Text>
      {rows.map((row) => <UnitRow key={row.dispatchId} row={row} />)}
    </View>
  );
}
