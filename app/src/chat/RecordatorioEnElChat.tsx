import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bell } from 'lucide-react-native';
import { agendaGet, type AgendaReminder } from '../agenda/agendaApi';
import { whenItRings, primerEnlace } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { useTarjetaViva } from './useTarjetaViva';
import { useAccionesDeTarjeta } from './accionesDeTarjeta';
import { TextoConEnlaces } from './TextoConEnlaces';
import { VistaPreviaDeEnlace } from './VistaPreviaDeEnlace';

/** Lo último que se vio de cada recordatorio, para que la celda reciclada no parpadee. `null` = ya no está. */
const recordatoriosVistos = new Map<string, AgendaReminder | null>();

/**
 * El recordatorio del GRUPO dentro del chat (José, 19/10): qué, cuándo suena,
 * la descripción y la imagen. Vive en el grupo y le suena a todos; lo editan
 * sus admins desde el detalle del grupo. Los links de la descripción se tocan
 * y el primero trae su tarjeta (José, 20/10: «quedaba como texto»).
 */
export function RecordatorioEnElChat({ reminderId, jwt, onLongPress }: { reminderId: string; jwt: string; onLongPress?: () => void }) {
  const colores = useColores();
  const [recordatorio, setRecordatorio] = useState<AgendaReminder | null | undefined>(() => recordatoriosVistos.get(reminderId));
  const [fallo, setFallo] = useState(false);
  const { editarRecordatorio } = useAccionesDeTarjeta();

  const cargar = useCallback(async () => {
    const respuesta = await agendaGet<{ reminder: AgendaReminder }>(`/reminders/${reminderId}`, jwt);
    if (respuesta.ok) {
      recordatoriosVistos.set(reminderId, respuesta.data.reminder);
      setRecordatorio(respuesta.data.reminder);
      setFallo(false);
    } else if (respuesta.status === 404) {
      recordatoriosVistos.set(reminderId, null);
      setRecordatorio(null);
    } else setFallo(true);
  }, [reminderId, jwt]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useTarjetaViva('recordatorio', reminderId, cargar);

  if (recordatorio === null) {
    return <Text className="px-1 text-[13px] italic text-on-surface-variant">Este recordatorio ya no está.</Text>;
  }
  if (recordatorio === undefined) {
    return fallo ? (
      <Pressable testID={`recordatorio-reintentar-${reminderId}`} onPress={() => void cargar()} className="min-h-[44px] justify-center rounded-xl border border-outline/10 bg-surface px-4">
        <Text className="text-[13px] text-on-surface-variant">No se pudo cargar el recordatorio. Toca para reintentar.</Text>
      </Pressable>
    ) : (
      <View className="h-28 rounded-xl bg-surface-variant" />
    );
  }
  // Un admin lo edita tocándolo; para los demás, la tarjeta no responde al toque.
  return (
    <Pressable
      testID={`recordatorio-en-chat-${reminderId}`}
      disabled={!editarRecordatorio}
      onPress={() => editarRecordatorio?.(recordatorio)}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityLabel={editarRecordatorio ? `Editar el recordatorio ${recordatorio.title}` : undefined}
      className="overflow-hidden rounded-xl border border-outline/10 bg-surface"
    >
      {recordatorio.imageUrl ? (
        <Image recyclingKey={recordatorio.imageUrl} source={{ uri: recordatorio.imageUrl }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" transition={120} />
      ) : null}
      <View className="gap-1 p-4">
        <View className="flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bell size={20} color={colores.primary} />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Recordatorio</Text>
            <Text className="text-[15px] font-semibold text-on-surface">{recordatorio.title}</Text>
            <Text className="text-[13px] text-on-surface-variant">{whenItRings(recordatorio)}</Text>
          </View>
        </View>
        {recordatorio.note ? (
          <Text className="mt-1 text-[14px] leading-5 text-on-surface">
            <TextoConEnlaces texto={recordatorio.note} />
          </Text>
        ) : null}
        {recordatorio.note && primerEnlace(recordatorio.note) ? <VistaPreviaDeEnlace url={primerEnlace(recordatorio.note)!} jwt={jwt} mia={false} /> : null}
      </View>
    </Pressable>
  );
}
