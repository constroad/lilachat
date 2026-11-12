import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Camera, Play } from 'lucide-react-native';
import { approximateLine, evidenceBadge, LIFTING_TYPE, observationCounts, observationNumber, observationPlace, observationsIn, registeredLine, reportTypeLabel, STATUS_PILLS, type Observation, type ObservationDocument, type ObservationStatus, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { Pill } from '../reports/ReportSections';
import { LiftObservationScreen } from './LiftObservationScreen';
import { NewObservationScreen } from './NewObservationScreen';
import { BottomAction, ObservationHeader, ObservationMapView } from './ObservationParts';
import { startObservation, useBackTo, useObservationReport, type ObservationTarget } from './useObservations';

type Props = ObservationTarget & { service: SpaceClientService; type: string; reportId?: string; portalUrl?: string; onClose: (changed: boolean) => void };
type Open = { kind: 'list' } | { kind: 'new'; start: Started } | { kind: 'one'; observation: Observation };
type Started = Extract<Awaited<ReturnType<typeof startObservation>>, { shot: unknown }>;

const MAP_HEIGHT = 220;
const TABS: { status: ObservationStatus; label: string }[] = [{ status: 'open', label: 'Pendientes' }, { status: 'lifted', label: 'Levantadas' }];

function Tabs(props: { counts: Record<ObservationStatus, number>; tab: ObservationStatus; onTab: (tab: ObservationStatus) => void }) {
  return (
    <View className="flex-row rounded-xl border border-primary/20 bg-primary/5 p-1">
      {TABS.map(({ status, label }) => (
        <Pressable key={status} testID={`pestana-${status}`} onPress={() => props.onTab(status)} className={`min-h-[56px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${props.tab === status ? 'bg-surface' : ''}`}>
          <Text className={`text-[15px] font-semibold ${props.tab === status ? 'text-primary' : 'text-on-surface-variant'}`}>{label}</Text>
          <Text className={`rounded-full px-1.5 text-[12px] font-bold ${status === 'open' ? 'bg-error text-on-primary' : 'border border-en-linea text-en-linea'}`}>{props.counts[status]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** The card's square: its first photo, or the mark of a video or of a camera, and its number. */
function Thumb({ observation }: { observation: Observation }) {
  const colors = useColores();
  const first = observation.media[0];
  const image = first && !first.mime.startsWith('video/') ? first.thumbUrl ?? first.url : first?.thumbUrl;
  return (
    <View className={`h-[76px] w-[76px] overflow-hidden rounded-xl ${observation.status === 'open' ? 'bg-error/10' : 'bg-en-linea/10'}`}>
      {image ? <Image source={{ uri: image }} className="absolute inset-0" resizeMode="cover" /> : null}
      <View className="flex-1 items-center justify-center">{first?.mime.startsWith('video/') ? <Play size={20} color={colors.primary} /> : image ? null : <Camera size={22} color={colors['on-surface-variant']} />}</View>
      <Text className={`absolute left-1 top-1 h-5 min-w-5 rounded-full px-1 text-center text-[11px] font-bold text-on-primary ${observation.status === 'open' ? 'bg-error' : 'bg-en-linea'}`}>{observationNumber(observation.code)}</Text>
      <Text className="absolute bottom-1 right-1 rounded bg-on-surface/70 px-1 text-[9px] font-bold text-surface">{evidenceBadge(observation.media)}</Text>
    </View>
  );
}

function ObservationCard(props: { observation: Observation; place: string; onPress: () => void }) {
  const { observation } = props;
  return (
    <Pressable testID={`observacion-${observation.code}`} onPress={props.onPress} className="flex-row gap-3 rounded-2xl border border-outline/15 bg-surface p-3">
      <Thumb observation={observation} />
      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text className="font-mono text-[13px] font-bold text-primary">{observation.code}</Text>
          <Text className="rounded-md bg-surface-variant px-1.5 font-mono text-[11px] text-on-surface-variant">{registeredLine(observation, '').trim()}{observation.lat !== null ? ' · GPS ✓' : ''}</Text>
        </View>
        <Text className="mt-1 text-[15px] font-bold text-on-surface" numberOfLines={2}>{observation.note}</Text>
        <Text className="mt-0.5 text-[13px] text-on-surface-variant" numberOfLines={1}>{props.place}</Text>
      </View>
      {/* In a row a pill stretches to the card's height (an oval): it keeps its own. */}
      <View className="self-start"><Pill badge={STATUS_PILLS[observation.status]} /></View>
    </Pressable>
  );
}

function ObservationList(props: { report: ObservationDocument; tab: ObservationStatus; onTab: (tab: ObservationStatus) => void; onOpen: (observation: Observation) => void }) {
  const { report } = props;
  const counts = observationCounts(report.observations);
  const shown = observationsIn(report.observations, props.tab);
  return (
    <>
      <ObservationMapView testID="mapa-observaciones" map={report.map} observations={report.observations} height={MAP_HEIGHT} />
      <Tabs counts={{ open: counts.open, lifted: counts.lifted }} tab={props.tab} onTab={props.onTab} />
      {shown.length ? shown.map((one) => <ObservationCard key={one.id} observation={one} place={[observationPlace(one, report.map), approximateLine(one)].filter(Boolean).join(' · ')} onPress={() => props.onOpen(one)} />) : (
        <Text testID="observaciones-vacio" className="py-6 text-center text-[14px] text-on-surface-variant">{props.tab === 'open' ? 'No hay observaciones pendientes.' : 'Todavía no se levantó ninguna.'}</Text>
      )}
      {report.publish.missing[0] ? <Text testID="publicar-desde-portal" className="text-center text-[13px] text-on-surface-variant">{report.publish.missing[0]}</Text> : null}
    </>
  );
}

/**
 * «Registro» and «Levantamiento» of observations from the client's channel
 * (José 11/11, design `ob-01`): the map, pending and lifted, and the camera
 * one tap away. Portal keeps the report; each write asks it again.
 */
export function ObservationsScreen(props: Props) {
  const colors = useColores();
  const to = useMemo(() => ({ target: props.target, chatId: props.chatId, serviceId: props.serviceId }), [props.target, props.chatId, props.serviceId]);
  const { draft, lastReport, reload } = useObservationReport(to, props.type, props.reportId ?? null);
  const [open, setOpen] = useState<Open>({ kind: 'list' });
  const [tab, setTab] = useState<ObservationStatus>('open');
  const [changed, setChanged] = useState(false);
  const back = useCallback(() => (open.kind === 'list' ? props.onClose(changed) : setOpen({ kind: 'list' })), [open.kind, props, changed]);
  useBackTo(back);
  const written = useCallback((reportId: string | undefined) => {
    setChanged(true);
    setOpen({ kind: 'list' });
    reload(props.type === LIFTING_TYPE ? undefined : reportId);
  }, [reload, props.type]);
  // A lift answers with the lifting report (LEV-OBS) even from the registry: this screen keeps asking for its own.
  const lifted = useCallback(() => written(undefined), [written]);
  const report = draft?.ok ? draft.document : null;
  const [notice, setNotice] = useState<string | null>(null);
  // §5-ter rule 2: the first tap opens the camera; the form comes after the shot.
  const begin = useCallback(async () => {
    setNotice(null);
    const started = await startObservation();
    if (started && 'shot' in started) setOpen({ kind: 'new', start: started });
    else if (started) setNotice(started.message);
  }, []);
  if (open.kind === 'new') return <NewObservationScreen to={to} report={lastReport} start={open.start} onBack={back} onDone={written} />;
  if (open.kind === 'one' && lastReport) return <LiftObservationScreen to={to} report={lastReport} observation={open.observation} onBack={back} onDone={lifted} />;
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={reportTypeLabel(props.type)} title="Observaciones" caption={props.service.name} onBack={back} />
      <ScrollView testID="observaciones" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {draft === null ? <Text className="py-6 text-center text-[14px] text-on-surface-variant">Trayendo las observaciones…</Text> : null}
        {draft && !draft.ok ? (
          <View testID="observaciones-fallo" className="gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
            <Text className="text-[15px] font-semibold text-on-surface">{draft.message}</Text>
            <Pressable testID="observaciones-reintentar" onPress={() => reload()} className="min-h-[56px] items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><Text className="text-[15px] font-semibold text-primary">Reintentar</Text></Pressable>
            {props.portalUrl ? (
              <Pressable testID="observaciones-portal" onPress={() => void Linking.openURL(props.portalUrl!)} className="min-h-[56px] items-center justify-center rounded-xl border border-outline/20">
                <Text className="text-[15px] font-semibold text-primary">Abrir el servicio en el Portal</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {report ? <ObservationList report={report} tab={tab} onTab={setTab} onOpen={(observation) => setOpen({ kind: 'one', observation })} /> : null}
      </ScrollView>
      {report ? <BottomAction testID="nueva-observacion" label="Nueva observación" icon={<Camera size={20} color={colors['on-primary']} />} busy={false} note={notice} onPress={() => void begin()} /> : null}
    </View>
  );
}
