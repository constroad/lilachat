import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronRight, FileText, Scan } from 'lucide-react-native';
import { areaCardLines, areaReportDay, areaTotalsLine, closedRing, PREVIEW_ASKING, PREVIEW_LABEL, type AdditionalArea, type AreaDocument, type ChannelLinks, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { ObservationHeader } from '../observations/ObservationParts';
import { useReportPdf } from '../useReportPdf';
import { ZoneEditScreen } from './ZoneEditScreen';
import { useBackTo, type ObservationTarget } from '../observations/useObservations';
import { arAvailability } from '../../../../modules/ar-measure/src';
import { ArMeasureScreen, type ArMeasured } from './ArMeasureScreen';
import { ArZoneScreen } from './ArZoneScreen';
import { PhotoMeasureScreen } from './PhotoMeasureScreen';
import { useAreaRemove, useAreaReport } from './useAreas';
import { useZonePlace } from './useZonePlace';
import { arShotEvidence, type CapturedEvidence } from '../useDriveUpload';
import { getCurrentSpaceId, useSpaceLogo } from '../../currentSpace';
import { useCameraLogo } from '../../../chat/camara/cameraLogoPref';
import { freshPoint } from '../../../chat/location/freshPoint';

type Props = { to: ObservationTarget; service: SpaceClientService; reportId?: string; links?: ChannelLinks; onClose: (changed: boolean) => void };

const decimals = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');
/** Where «Medir área» goes: the AR (la-02 → la-03) when the phone has it, else the photo with the tape (la-05). */
type Mode = { kind: 'list' } | { kind: 'ar' } | { kind: 'ar-zone'; measured: ArMeasured; evidence: CapturedEvidence | null } | { kind: 'photo' } | { kind: 'zone'; areaId: string };

/** Design la-01: the report, its totals (Área · Volumen · Zonas), each zone and «Medir área» (72 px). */
export function AreasScreen(props: Props) {
  const { draft, report, reload } = useAreaReport(props.to, props.reportId ?? null);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [changed, setChanged] = useState(false);
  const remove = useAreaRemove(props.to, () => { setChanged(true); setMode({ kind: 'list' }); reload(report?.id); });
  // A draft's PDF is Portal's signed preview, opened in the browser (the same «Ver PDF» as the other reports).
  const pdf = useReportPdf(props.to.target, props.to.serviceId, () => undefined);
  const close = () => props.onClose(changed);
  const toList = () => setMode({ kind: 'list' });
  useBackTo(mode.kind === 'list' ? close : toList);
  const zone = (report?.areas.length ?? 0) + 1;
  const saved = (reportId: string) => { setChanged(true); toList(); reload(reportId); };
  // The GPS and the street are read when the report opens: ready before the first corner (José 15/11).
  const [round, setRound] = useState(0);
  const place = useZonePlace(props.to, props.links, round);
  const modeNow = useRef(mode.kind);
  modeNow.current = mode.kind;
  const logoOn = useCameraLogo();
  const spaceLogo = useSpaceLogo(getCurrentSpaceId());
  const stampsLogo = logoOn && Boolean(spaceLogo);
  const measured = async (reading: ArMeasured) => {
    const point = place.point ?? (await freshPoint().catch(() => null));
    const evidence = reading.photo ? await arShotEvidence(reading.photo, point, stampsLogo).catch(() => null) : null;
    // «Salir» while the photo was being prepared: the zone is not opened behind the person's back.
    if (modeNow.current !== 'ar') return;
    setMode({ kind: 'ar-zone', measured: { ...reading, points: closedRing(reading.points) }, evidence });
  };
  const startMeasure = async () => {
    setRound((before) => before + 1);
    setMode({ kind: (await arAvailability()) === 'unsupported' ? 'photo' : 'ar' });
  };
  if (mode.kind === 'photo') return <PhotoMeasureScreen to={props.to} report={report} zone={zone} place={place} onBack={toList} onSaved={saved} />;
  if (mode.kind === 'ar') return <ArMeasureScreen kicker={report?.code ?? 'IAA'} reportCode={report?.code ?? null} zone={zone} place={place} onBack={toList} onPhotoInstead={() => setMode({ kind: 'photo' })} onMeasured={(reading) => void measured(reading)} />;
  const editing = mode.kind === 'zone' ? report?.areas.findIndex((area) => area.id === mode.areaId) ?? -1 : -1;
  if (mode.kind === 'zone' && report && editing >= 0) return <ZoneEditScreen to={props.to} report={report} area={report.areas[editing]!} number={editing + 1} onRemove={remove} onBack={toList} onSaved={() => saved(report.id)} />;
  if (mode.kind === 'ar-zone') return <ArZoneScreen to={props.to} report={report} zone={zone} measured={mode.measured} evidence={mode.evidence} place={place} onBack={toList} onRemeasure={() => setMode({ kind: 'ar' })} onSaved={saved} />;
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={report?.code ?? 'Informe de área adicional'} title="Área adicional" onBack={close} />
      <ScrollView testID="areas-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {draft === null ? <View className="h-40 rounded-2xl bg-surface" /> : null}
        {draft && !draft.ok ? <Text testID="areas-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4 text-[15px] text-on-surface">{draft.message}</Text> : null}
        {report ? <ReportBody report={report} service={props.service.name} onOpen={(areaId) => setMode({ kind: 'zone', areaId })} /> : null}
        {pdf.message ? <Text testID="areas-pdf-error" className="text-center text-[13px] font-semibold text-error">{pdf.message}</Text> : null}
      </ScrollView>
      <AreasFooter canPdf={Boolean(report?.id && report.areas.length)} asking={pdf.asking} busy={!report} onPdf={() => report && void pdf.ask(report.id, `${report.code ?? 'IAA'}.pdf`, true)} onMeasure={() => void startMeasure()} />
    </View>
  );
}

/** «Ver PDF» beside «Medir área» (José 15/11: «no hay aún opción de ver informe pdf»), like the other reports. */
function AreasFooter(props: { canPdf: boolean; asking: boolean; busy: boolean; onPdf: () => void; onMeasure: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row gap-2 border-t border-outline/10 bg-surface px-4 pb-4 pt-3">
      {props.canPdf ? (
        <Pressable testID="areas-ver-pdf" onPress={props.onPdf} disabled={props.asking} className={`min-h-[72px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 ${props.asking ? 'opacity-60' : ''}`}>
          <FileText size={20} color={colors.primary} />
          <Text className="text-[15px] font-semibold text-primary" numberOfLines={1}>{props.asking ? PREVIEW_ASKING : PREVIEW_LABEL}</Text>
        </Pressable>
      ) : null}
      <Pressable testID="medir-area" onPress={props.onMeasure} disabled={props.busy} className={`min-h-[72px] flex-[2] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${props.busy ? 'opacity-60' : ''}`}>
        <Scan size={22} color={colors['on-primary']} />
        <Text className="text-[17px] font-bold text-on-primary">Medir área</Text>
      </Pressable>
    </View>
  );
}

function ReportBody({ report, service, onOpen }: { report: AreaDocument; service: string; onOpen: (areaId: string) => void }) {
  return (
    <>
      <ReportHeading report={report} service={service} />
      <Totals report={report} />
      <Text className="mt-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{`Zonas medidas · ${report.areas.length}`}</Text>
      {report.areas.length ? report.areas.map((area, index) => <ZoneCard key={area.id} area={area} number={index + 1} onOpen={() => onOpen(area.id)} />) : <Text testID="areas-vacio" className="py-4 text-center text-[14px] text-on-surface-variant">Todavía no hay zonas. Toca «Medir área».</Text>}
    </>
  );
}

const SourceTag = ({ label }: { label: string }) => <Text className="rounded-md border border-outline/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">{label}</Text>;

/** Design la-01: the report's code, the service and the day, each with where it comes from. */
function ReportHeading({ report, service }: { report: AreaDocument; service: string }) {
  const day = areaReportDay(report.date);
  return (
    <View testID="areas-encabezado" className="gap-2 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Informe de área adicional</Text>
        {report.code ? <Text className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[12px] font-bold text-primary">{report.code}</Text> : null}
      </View>
      <View className="flex-row items-start gap-2">
        <Text className="flex-1 text-[17px] font-bold text-on-surface">{service}</Text>
        <SourceTag label="Del servicio" />
      </View>
      {day ? (
        <View className="flex-row items-center gap-2 border-t border-outline/10 pt-2">
          <Text className="flex-1 text-[15px] text-on-surface-variant">{day}</Text>
          <SourceTag label="Del reloj" />
        </View>
      ) : null}
    </View>
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
    <View testID="areas-total" accessibilityLabel={areaTotalsLine({ count: report.areas.length, totals: report.totals })} className="gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Total</Text>
        <Text className="rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">Calculado</Text>
      </View>
      <View className="flex-row gap-3">
        {figure('Área', decimals(report.totals.areaM2, 2), 'm²')}
        {figure('Volumen', report.totals.volumeM3 > 0 ? decimals(report.totals.volumeM3, 3) : '—', report.totals.volumeM3 > 0 ? 'm³' : undefined)}
        {figure('Zonas', String(report.areas.length))}
      </View>
    </View>
  );
}

/** Design la-01: number, place, description, method and figures; a tap opens it (la-06). */
function ZoneCard({ area, number, onOpen }: { area: AdditionalArea; number: number; onOpen: () => void }) {
  const colors = useColores();
  const lines = areaCardLines(area);
  const thickness = area.thicknessCm !== undefined ? `${decimals(area.thicknessCm, 1)} cm` : null;
  return (
    <Pressable testID={`area-${area.id}`} onPress={onOpen} accessibilityLabel={`Abrir la zona ${number}`} className="flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-3">
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
      <ChevronRight size={18} color={colors['on-surface-variant']} />
    </Pressable>
  );
}
