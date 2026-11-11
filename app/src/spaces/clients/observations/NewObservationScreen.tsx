import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { CheckCircle2 } from 'lucide-react-native';
import { OBSERVATION_NOTE_MAX, REGISTRY_TYPE, registerRequest, reportTypeLabel, type ObservationDocument } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { BottomAction, CaptureButtons, CapturedRow, ObservationHeader, ObservationMapView, SectionTitle } from './ObservationParts';
import { useEvidence, useFieldPlace, useObservationWrite, type ObservationTarget } from './useObservations';

const MAP_HEIGHT = 170;
const PLACE_LINES = { reading: 'Buscando GPS…', ready: 'GPS activo', missing: 'Sin GPS' } as const;

function PlaceCard(props: { report: ObservationDocument | null; place: ReturnType<typeof useFieldPlace> }) {
  const { place } = props.place;
  const here = place.state === 'ready' ? place.point : null;
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <SectionTitle title="Ubicación en la obra" side={PLACE_LINES[place.state]} sideTone={place.state === 'missing' ? 'error' : 'primary'} />
      {props.report ? <ObservationMapView testID="mapa-nueva" map={props.report.map} observations={props.report.observations} here={here} height={MAP_HEIGHT} /> : null}
      {here ? <Text className="font-mono text-[12px] text-on-surface-variant">{here.lat.toFixed(6)}, {here.lng.toFixed(6)}{here.precision ? ` · ±${Math.round(here.precision)} m` : ''}</Text> : null}
      {place.state === 'missing' ? (
        <Pressable testID="reintentar-gps" onPress={() => void props.place.retry()} className="min-h-[44px] items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
          <Text className="text-[14px] font-semibold text-primary">Leer el GPS de nuevo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * «Nueva observación» (design `ob-02`): photos and videos first, the GPS reads
 * itself, the note is optional (José 11/11: «en campo no siempre escriben»).
 * The entry's key lives as long as the screen, so «Registrar» again after a
 * failure lands on the same observation.
 */
export function NewObservationScreen(props: { to: ObservationTarget; report: ObservationDocument | null; onBack: () => void; onDone: (reportId: string) => void }) {
  const colors = useColores();
  const [entryId] = useState(() => Crypto.randomUUID());
  const [note, setNote] = useState('');
  const place = useFieldPlace();
  const evidence = useEvidence();
  const write = useObservationWrite(props.to, props.onDone);
  const here = place.place.state === 'ready' ? place.place.point : null;
  const register = () => void write.run(here ? registerRequest(props.report, entryId, here) : null, note, evidence.items, 'registrada');
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
        <PlaceCard report={props.report} place={place} />
        <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
          <SectionTitle title="¿Qué se observa?" side="Opcional" />
          <TextInput testID="nota-observacion" value={note} onChangeText={setNote} maxLength={OBSERVATION_NOTE_MAX} multiline placeholder="Qué se ve, dónde y cuánto" placeholderTextColor={colors['on-surface-variant']} className="min-h-[96px] rounded-xl border border-outline/20 bg-background p-3 text-[16px] text-on-surface" textAlignVertical="top" />
          <Text className="text-[12px] text-on-surface-variant">Para dictar sin sacarte los guantes, toca el micrófono del teclado.</Text>
        </View>
      </ScrollView>
      <BottomAction testID="registrar-observacion" label="Registrar observación" icon={<CheckCircle2 size={20} color={colors['on-primary']} />} disabled={!here} busy={write.busy} note={write.line ?? (here ? null : 'Espera el GPS para registrar.')} onPress={register} />
    </View>
  );
}
