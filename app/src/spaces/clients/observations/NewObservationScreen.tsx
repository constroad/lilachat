import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { CheckCircle2, LocateFixed } from 'lucide-react-native';
import { gpsLine, OBSERVATION_NOTE_MAX, observationPlace, REGISTRY_TYPE, registerAction, registerRequest, reportTypeLabel, type ObservationDocument } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, CaptureButtons, CapturedRow, ObservationHeader, ObservationMapView, SectionTitle } from './ObservationParts';
import { startObservation, useEvidence, useFieldPlace, useObservationWrite, type ObservationTarget } from './useObservations';

type Started = Extract<Awaited<ReturnType<typeof startObservation>>, { shot: unknown }>;

const MAP_HEIGHT = 170;

/** Where it is (§5-ter rule 3): the street when the work map has it, and «GPS ±N m»; never the coordinates. */
function PlaceCard(props: { report: ObservationDocument | null; place: ReturnType<typeof useFieldPlace>['place'] }) {
  const { place } = props;
  const here = place.state === 'ready' ? place.point : null;
  const side = here ? gpsLine(here.precision) : place.state === 'reading' ? 'Buscando GPS…' : 'Sin GPS';
  const street = here && props.report ? observationPlace({ id: 'aqui', code: '', note: '', at: null, status: 'open', media: [], liftMedia: [], lat: here.lat, lng: here.lng }, props.report.map) : null;
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Ubicación en la obra" side={side} sideTone={place.state === 'missing' ? 'error' : 'primary'} />
      {props.report ? <ObservationMapView testID="mapa-nueva" map={props.report.map} observations={props.report.observations} here={here} height={MAP_HEIGHT} /> : null}
      {street ? <Text className="text-[14px] text-on-surface">{street}</Text> : null}
    </View>
  );
}

/**
 * «Nueva observación» (design `ob-02`): photos and videos first, the GPS reads
 * itself, the note is optional (José 11/11: «en campo no siempre escriben»).
 * The entry's key lives as long as the screen, so «Registrar» again after a
 * failure lands on the same observation.
 */
export function NewObservationScreen(props: { to: ObservationTarget; report: ObservationDocument | null; start: Started; onBack: () => void; onDone: (reportId: string) => void }) {
  const colors = useColores();
  const [entryId] = useState(() => Crypto.randomUUID());
  const [note, setNote] = useState('');
  const place = useFieldPlace(props.start.reading);
  const evidence = useEvidence([props.start.shot]);
  const write = useObservationWrite(props.to, props.onDone);
  const here = place.place.state === 'ready' ? place.place.point : null;
  const action = registerAction(place.place.state);
  const press = () => {
    if (action.kind === 'gps-retry') return place.retry();
    if (here) void write.run(registerRequest(props.report, entryId, here, 'apk'), note, evidence.items, 'registrada');
  };
  return (
    <View className="flex-1 bg-background">
      <ObservationHeader kicker={reportTypeLabel(REGISTRY_TYPE)} title="Nueva observación" onBack={props.onBack} />
      <ScrollView testID="nueva-observacion-pantalla" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
          <SectionTitle title={`Evidencias en terreno (${evidence.items.length})`} />
          <CapturedRow items={evidence.items} onRemove={evidence.remove} />
          <CaptureButtons disabled={write.busy} onTake={(kind) => void evidence.take(kind)} />
          {evidence.message ? <Text className="text-[13px] text-error">{evidence.message}</Text> : null}
        </View>
        <PlaceCard report={props.report} place={place.place} />
        <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
          <SectionTitle title="¿Qué se observa?" side="Opcional" />
          <TextInput testID="nota-observacion" value={note} onChangeText={setNote} maxLength={OBSERVATION_NOTE_MAX} multiline placeholder="Qué se ve, dónde y cuánto" placeholderTextColor={colors['on-surface-variant']} className="min-h-[96px] rounded-xl border border-outline/20 bg-background p-3 text-[16px] text-on-surface" textAlignVertical="top" />
          <Text className="text-[12px] text-on-surface-variant">Para dictar sin sacarte los guantes, toca el micrófono del teclado.</Text>
        </View>
      </ScrollView>
      <BottomAction testID="registrar-observacion" label={action.label} icon={action.kind === 'register' ? <CheckCircle2 size={20} color={colors['on-primary']} /> : <LocateFixed size={20} color={colors['on-primary']} />} busy={write.busy || action.kind === 'gps-wait'} note={write.line} onPress={press} />
    </View>
  );
}
