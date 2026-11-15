import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Scan, Trash2 } from 'lucide-react-native';
import { areaCardLines, areaRemoveAsk, areaTotalsLine, isRemovableArea, type AdditionalArea, type AreaDocument, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader } from '../observations/ObservationParts';
import { useBackTo, type ObservationTarget } from '../observations/useObservations';
import { PhotoMeasureScreen } from './PhotoMeasureScreen';
import { useAreaRemove, useAreaReport } from './useAreas';

type Props = { to: ObservationTarget; service: SpaceClientService; reportId?: string; onClose: (changed: boolean) => void };

const decimals = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

/** Design la-01: the report, its totals (Área · Volumen · Zonas), each zone and «Medir área» (72 px). */
export function AreasScreen(props: Props) {
  const { draft, report, reload } = useAreaReport(props.to, props.reportId ?? null);
  const [measuring, setMeasuring] = useState(false);
  const [changed, setChanged] = useState(false);
  const remove = useAreaRemove(props.to, () => { setChanged(true); reload(report?.id); });
  const close = () => props.onClose(changed);
  useBackTo(measuring ? () => setMeasuring(false) : close);
  if (measuring) {
    return <PhotoMeasureScreen to={props.to} report={report} zone={(report?.areas.length ?? 0) + 1} onBack={() => setMeasuring(false)} onSaved={(reportId) => { setChanged(true); setMeasuring(false); reload(reportId); }} />;
  }
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={report?.code ?? 'Informe de área adicional'} title="Área adicional" caption={props.service.name} onBack={close} />
      <ScrollView testID="areas-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {draft === null ? <View className="h-40 rounded-2xl bg-surface" /> : null}
        {draft && !draft.ok ? <Text testID="areas-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4 text-[15px] text-on-surface">{draft.message}</Text> : null}
        {report ? <ReportBody report={report} remove={remove} /> : null}
      </ScrollView>
      <BottomAction testID="medir-area" label="Medir área" icon={<Scan size={22} color="white" />} busy={!report} onPress={() => setMeasuring(true)} />
    </View>
  );
}

function ReportBody({ report, remove }: { report: AreaDocument; remove: ReturnType<typeof useAreaRemove> }) {
  return (
    <>
      <Totals report={report} />
      <Text className="mt-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{`Zonas medidas · ${report.areas.length}`}</Text>
      {report.areas.length ? report.areas.map((area, index) => <ZoneCard key={area.id} area={area} number={index + 1} remove={remove} />) : <Text testID="areas-vacio" className="py-4 text-center text-[14px] text-on-surface-variant">Todavía no hay zonas. Toca «Medir área».</Text>}
    </>
  );
}

function Totals({ report }: { report: AreaDocument }) {
  const figure = (label: string, value: string, unit?: string) => (
    <View className="flex-1">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{label}</Text>
      <Text className="mt-1 text-[24px] font-extrabold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{value}{unit ? <Text className="text-[13px] font-semibold text-on-surface-variant">{` ${unit}`}</Text> : null}</Text>
    </View>
  );
  return (
    <View testID="areas-total" accessibilityLabel={areaTotalsLine({ count: report.areas.length, totals: report.totals })} className="flex-row gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
      {figure('Área', decimals(report.totals.areaM2, 2), 'm²')}
      {figure('Volumen', decimals(report.totals.volumeM3, 3), 'm³')}
      {figure('Zonas', String(report.areas.length))}
    </View>
  );
}

function ZoneCard({ area, number, remove }: { area: AdditionalArea; number: number; remove: ReturnType<typeof useAreaRemove> }) {
  const colors = useColores();
  const lines = areaCardLines(area);
  const [asking, setAsking] = useState(false);
  const thickness = area.thicknessCm !== undefined ? `${decimals(area.thicknessCm, 1)} cm` : null;
  return (
    <View testID={`area-${area.id}`} className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Text className="text-[16px] font-bold text-primary">{number}</Text></View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-semibold text-on-surface" numberOfLines={1}>{area.place ?? `Zona ${number}`}</Text>
          {area.description ? <Text className="text-[14px] text-on-surface-variant" numberOfLines={2}>{area.description}</Text> : null}
          {lines.method ? <Text className="mt-1 self-start rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">{lines.method}</Text> : null}
        </View>
        <View className="items-end">
          <Text className="text-[18px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{lines.size}</Text>
          {thickness || lines.volume ? <Text className="text-[13px] text-on-surface-variant">{[thickness, lines.volume].filter(Boolean).join(' · ')}</Text> : null}
        </View>
      </View>
      {isRemovableArea(area) ? <RemoveRow area={area} asking={asking} setAsking={setAsking} remove={remove} color={colors['on-surface-variant']} /> : null}
    </View>
  );
}

function RemoveRow(props: { area: AdditionalArea; asking: boolean; setAsking: (value: boolean) => void; remove: ReturnType<typeof useAreaRemove>; color: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = areaRemoveAsk(props.area.item);
  if (!props.asking) {
    return <Pressable testID={`quitar-area-${props.area.id}`} onPress={() => props.setAsking(true)} accessibilityLabel={ask.title} className="h-11 flex-row items-center gap-1.5 self-end px-2"><Trash2 size={16} color={props.color} /><Text className="text-[13px] text-on-surface-variant">Quitar</Text></Pressable>;
  }
  const confirm = async () => {
    setBusy(true);
    const result = await props.remove(props.area.id);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <View className="gap-2 rounded-xl border border-error/30 bg-error/5 p-3">
      <Text className="text-[14px] font-bold text-on-surface">{ask.title}</Text>
      <Text className="text-[12px] text-on-surface-variant">{ask.hint}</Text>
      {error ? <Text className="text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable onPress={() => props.setAsking(false)} disabled={busy} className="h-11 flex-1 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[13px] font-semibold text-on-surface">Cancelar</Text></Pressable>
        <Pressable testID={`quitar-area-si-${props.area.id}`} onPress={() => void confirm()} disabled={busy} className="h-11 flex-1 items-center justify-center rounded-xl bg-error"><Text className="text-[13px] font-bold text-background">{busy ? 'Quitando…' : 'Quitar'}</Text></Pressable>
      </View>
    </View>
  );
}
