import { useSyncExternalStore } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { CloudUpload } from 'lucide-react-native';
import { fieldJobsOfService, fieldQueueLine } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { discardFieldWork, fieldQueueNow, retryFieldWork, subscribeFieldQueue } from './fieldQueueStore';

/** Throwing away a photo taken at the site cannot be undone: it asks first. */
function askDiscard(key: string, label: string): void {
  Alert.alert('¿Descartar?', `${label}: se borra del teléfono y no se envía.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Descartar', style: 'destructive', onPress: () => void discardFieldWork(key) },
  ]);
}

/**
 * What of this service waits on the phone (José 26/11): «3 por subir · se suben solos con señal»,
 * and each refused one with Portal's words, «Reintentar» and «Descartar». Nothing when it is empty.
 */
export function FieldQueueStrip({ serviceId, alsoIds = [] }: { serviceId: string; /** Other «services» of the same thing (a visit's local id). */ alsoIds?: readonly string[] }) {
  const colors = useColores();
  const jobs = useSyncExternalStore(subscribeFieldQueue, fieldQueueNow);
  const summaries = [...new Set([serviceId, ...alsoIds])].map((id) => fieldJobsOfService(jobs, id));
  const waiting = summaries.reduce((total, one) => total + one.waiting, 0);
  const refused = summaries.flatMap((one) => one.refused);
  if (!waiting && !refused.length) return null;
  return (
    <View testID="cola-de-campo" className="gap-2 rounded-xl border border-outline/15 bg-surface-variant px-3 py-2">
      {waiting ? (
        <View className="flex-row items-center gap-2">
          <CloudUpload size={16} color={colors['on-surface-variant']} />
          <Text testID="cola-de-campo-esperando" className="flex-1 text-[13px] text-on-surface-variant">{fieldQueueLine(waiting)}</Text>
        </View>
      ) : null}
      {refused.map((job) => (
        <View key={job.key} testID="cola-de-campo-rechazado" className="gap-1">
          <Text className="text-[13px] font-semibold text-on-surface">{job.label}</Text>
          <Text className="text-[13px] text-error">{job.refusal}</Text>
          <View className="flex-row gap-2">
            <Pressable testID="cola-de-campo-reintentar" onPress={() => void retryFieldWork(job.key)} className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-primary/30">
              <Text className="text-[14px] font-semibold text-primary">Reintentar</Text>
            </Pressable>
            <Pressable testID="cola-de-campo-descartar" onPress={() => askDiscard(job.key, job.label)} className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-outline/20">
              <Text className="text-[14px] font-semibold text-on-surface">Descartar</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
