import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bell, Pencil } from 'lucide-react-native';
import { primerEnlace, whenItRings } from '@lilachat/shared';
import { agendaGet, type AgendaReminder } from './agendaApi';
import { TextoConEnlaces } from '../chat/TextoConEnlaces';
import { VistaPreviaDeEnlace } from '../chat/VistaPreviaDeEnlace';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { useColores } from '../ui/tema';

/**
 * A reminder opened to read it (pending 76, José 23/10): from the notice that
 * rang in the chat, from its card or from the full-screen alarm. The note's
 * links are tapped right here and the first one brings its card (a YouTube
 * video plays inside the app); no need to open the form and copy the link.
 */
export function ReminderDetailScreen(props: { reminderId: string | null; jwt: string; onClose: () => void; onEdit?: (reminder: AgendaReminder) => void }) {
  const colors = useColores();
  const [reminder, setReminder] = useState<AgendaReminder | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    setReminder(undefined);
    setError('');
    if (!props.reminderId) return;
    void agendaGet<{ reminder: AgendaReminder }>(`/reminders/${props.reminderId}`, props.jwt).then((response) => {
      if (response.ok) setReminder(response.data.reminder);
      else if (response.status === 404) setReminder(null);
      else setError(response.message ?? 'No se pudo abrir el recordatorio. Revisa la conexión.');
    });
  }, [props.reminderId, props.jwt]);
  const link = reminder?.note ? primerEnlace(reminder.note) : null;

  return (
    <PantallaEnModal visible={props.reminderId !== null} titulo="Recordatorio" onCerrar={props.onClose} testIDCerrar="detalle-recordatorio-volver">
      <View testID="detalle-recordatorio">
        {error ? <Text className="text-[14px] text-error">{error}</Text> : null}
        {reminder === undefined && !error ? <ActivityIndicator className="mt-8" color={colors.primary} /> : null}
        {reminder === null ? <Text className="mt-8 text-center text-[14px] text-on-surface-variant">Este recordatorio ya no está.</Text> : null}
        {reminder ? (
          <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
            {reminder.imageUrl ? <Image source={{ uri: reminder.imageUrl }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" transition={120} /> : null}
            <View className="gap-2 p-4">
              <View className="flex-row items-start gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10"><Bell size={22} color={colors.primary} /></View>
                <View className="min-w-0 flex-1">
                  <Text testID="detalle-recordatorio-titulo" className="text-[20px] font-bold text-on-surface">{reminder.title}</Text>
                  <Text className="mt-0.5 text-[14px] text-on-surface-variant">{whenItRings(reminder)}</Text>
                  {reminder.chat?.name ? <Text className="text-[13px] text-on-surface-variant">{reminder.chat.name}</Text> : null}
                </View>
              </View>
              {reminder.note ? (
                <Text testID="detalle-recordatorio-nota" selectable className="mt-1 text-[16px] leading-6 text-on-surface">
                  <TextoConEnlaces texto={reminder.note} />
                </Text>
              ) : null}
              {link ? <VistaPreviaDeEnlace url={link} jwt={props.jwt} mia={false} /> : null}
            </View>
          </View>
        ) : null}
        {reminder && props.onEdit ? (
          <Pressable testID="detalle-recordatorio-editar" onPress={() => props.onEdit?.(reminder)} className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-xl border border-primary/30">
            <Pencil size={16} color={colors.primary} />
            <Text className="text-[15px] font-semibold text-primary">Editar</Text>
          </Pressable>
        ) : null}
      </View>
    </PantallaEnModal>
  );
}
