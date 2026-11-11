import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2, MapPin } from 'lucide-react-native';
import { evidenceFiles, liftBlocker, liftRequest, OBSERVATION_NOTE_MAX, observationPlace, registeredLine, STATUS_PILLS, type Observation, type ObservationDocument } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { Pill } from '../reports/ReportSections';
import { useFileViewer } from '../useFileViewer';
import { BottomAction, CaptureButtons, CapturedRow, MediaRow, ObservationHeader, ObservationMapView, SectionTitle } from './ObservationParts';
import { useEvidence, useObservationWrite, type ObservationTarget } from './useObservations';

const MAP_HEIGHT = 150;

/** Where and when it was registered (design `ob-03`, top card). */
function PlaceCard({ observation, report }: { observation: Observation; report: ObservationDocument }) {
  const colors = useColores();
  return (
    <View className="gap-1 rounded-2xl border border-outline/15 bg-surface p-3">
      <View className="flex-row items-center gap-1.5">
        <MapPin size={16} color={colors.primary} />
        <Text className="font-mono text-[14px] text-on-surface">{observationPlace(observation, report.map)}</Text>
      </View>
      <Text className="text-[13px] text-on-surface-variant">{registeredLine(observation)}</Text>
    </View>
  );
}

/** The «after» half: what Portal holds once lifted, or the camera and the note while pending. */
function AfterCard(props: { observation: Observation; evidence: ReturnType<typeof useEvidence>; note: string; onNote: (note: string) => void; busy: boolean; onOpen: (index: number) => void }) {
  const colors = useColores();
  const { observation, evidence } = props;
  if (observation.status === 'lifted') {
    return (
      <View className="gap-2 rounded-2xl border border-en-linea/30 bg-surface p-3">
        <SectionTitle title="Después" side={registeredLine({ at: observation.liftedAt ?? null }, 'Levantada')} />
        <MediaRow media={observation.liftMedia} testID="despues" onOpen={props.onOpen} />
        {observation.liftNote ? <Text className="text-[14px] text-on-surface">{observation.liftNote}</Text> : null}
      </View>
    );
  }
  return (
    <View className="gap-2 rounded-2xl border-[1.5px] border-primary/40 bg-surface p-3">
      <SectionTitle title="Después" side={evidence.items.length ? `${evidence.items.length} tomada${evidence.items.length === 1 ? '' : 's'}` : 'Por tomar'} />
      <CapturedRow items={evidence.items} onRemove={evidence.remove} />
      <CaptureButtons disabled={props.busy} onTake={(kind) => void evidence.take(kind)} />
      {evidence.message ? <Text className="text-[13px] text-error">{evidence.message}</Text> : null}
      <TextInput testID="nota-levantamiento" value={props.note} onChangeText={props.onNote} maxLength={OBSERVATION_NOTE_MAX} multiline placeholder="Cómo se corrigió (opcional)" placeholderTextColor={colors['on-surface-variant']} className="min-h-[72px] rounded-xl border border-outline/20 bg-background p-3 text-[16px] text-on-surface" textAlignVertical="top" />
    </View>
  );
}

/**
 * One observation (design `ob-03`): its before, and its after to lift it.
 * «Marcar como levantada» waits for a photo or video of after; Portal keeps
 * the date the first time and only the note on a repeat.
 */
export function LiftObservationScreen(props: { to: ObservationTarget; report: ObservationDocument; observation: Observation; onBack: () => void; onDone: (reportId: string) => void }) {
  const colors = useColores();
  const { observation, report } = props;
  const [note, setNote] = useState('');
  const evidence = useEvidence();
  const write = useObservationWrite(props.to, props.onDone);
  const files = useFileViewer();
  const before = evidenceFiles(observation.media, `${observation.code} · antes`);
  const after = evidenceFiles(observation.liftMedia, `${observation.code} · después`);
  const blocker = liftBlocker(evidence.items.length);
  const lift = () => void write.run(liftRequest(report, observation.id), note, evidence.items, 'levantada');
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={`Levantamiento · ${observation.code}`} title={observation.note} onBack={props.onBack} side={<Pill badge={STATUS_PILLS[observation.status]} testID="estado-observacion" />} />
      <ScrollView testID="observacion-detalle" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <PlaceCard observation={observation} report={report} />
        <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
          <SectionTitle title="Antes" side={`${observation.media.length} evidencia${observation.media.length === 1 ? '' : 's'}`} />
          <MediaRow media={observation.media} testID="antes" onOpen={(index) => files.open(before[index]!, before)} />
        </View>
        <AfterCard observation={observation} evidence={evidence} note={note} onNote={setNote} busy={write.busy} onOpen={(index) => files.open(after[index]!, after)} />
        <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
          <SectionTitle title="Ubicación en la obra" />
          <ObservationMapView testID="mapa-observacion" map={report.map} observations={[observation]} height={MAP_HEIGHT} />
        </View>
        {files.notice ? <Text className="text-center text-[13px] text-error">{files.notice}</Text> : null}
      </ScrollView>
      {observation.status === 'open' ? <BottomAction testID="marcar-levantada" tone="ok" label="Marcar como levantada" icon={<CheckCircle2 size={20} color={colors['on-primary']} />} disabled={Boolean(blocker)} busy={write.busy} note={write.line ?? blocker} onPress={lift} /> : null}
      {files.viewer}
    </View>
  );
}
