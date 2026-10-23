import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Bell, Clock, FileText } from 'lucide-react-native';
import { ReminderDetailScreen } from './ReminderDetailScreen';
import { formatClock } from '@lilachat/shared';
import { llamadaNativa, type ReminderAlarm } from '../../modules/llamada-entrante/src';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/**
 * The reminder big, over the lock screen, like Google Calendar (pending 63,
 * José 22/10). The native full-screen notice opens the app with it; here it is
 * shown with «Listo» and «Posponer 10 min», and the lock is released after.
 */
export function ReminderAlarmHost(props: { jwt: string }) {
  const colors = useColores();
  const margins = useMargenes();
  const [alarm, setAlarm] = useState<{ reminder: ReminderAlarm; at: Date } | null>(null);
  // Pending 76: «Ver recordatorio» opens it to read the note, the image and the links.
  const [reading, setReading] = useState<string | null>(null);
  const check = useCallback(() => {
    const pending = llamadaNativa.reminderPending();
    if (pending) setAlarm({ reminder: pending, at: new Date() });
  }, []);

  useEffect(() => {
    check();
    const tapped = llamadaNativa.onReminder(check);
    const state = AppState.addEventListener('change', (next) => next === 'active' && check());
    return () => {
      tapped.remove();
      state.remove();
    };
  }, [check]);

  if (!alarm) return reading ? <ReminderDetailScreen reminderId={reading} jwt={props.jwt} onClose={() => setReading(null)} /> : null;
  const close = (snooze: boolean) => {
    if (snooze) llamadaNativa.snoozeReminder(alarm.reminder);
    // Never left on: anyone could browse the chats of a locked phone afterwards.
    llamadaNativa.soltarBloqueo();
    setAlarm(null);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={() => close(false)}>
      <View testID="recordatorio-pantalla-completa" className="flex-1 items-center justify-between bg-primary px-6" style={{ paddingTop: margins.cabecera + 48, paddingBottom: margins.pie + 24 }}>
        <View className="items-center">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-on-primary/15">
            <Bell size={44} color={colors['on-primary']} />
          </View>
          <Text className="mt-6 text-[15px] font-semibold uppercase tracking-[2px] text-on-primary/80">Recordatorio</Text>
          <Text className="mt-2 text-[56px] font-light text-on-primary">{formatClock(alarm.at)}</Text>
        </View>
        <View className="w-full items-center">
          <Text testID="recordatorio-titulo" className="text-center text-[30px] font-bold leading-9 text-on-primary">{alarm.reminder.title}</Text>
          {alarm.reminder.note ? <Text className="mt-3 text-center text-[17px] leading-6 text-on-primary/85">{alarm.reminder.note}</Text> : null}
          {alarm.reminder.chat ? <Text className="mt-3 text-center text-[14px] text-on-primary/70">{alarm.reminder.chat}</Text> : null}
        </View>
        <View className="w-full gap-3">
          {alarm.reminder.id ? (
            <Pressable testID="btn-recordatorio-ver" onPress={() => (setReading(alarm.reminder.id), close(false))} className="min-h-[48px] flex-row items-center justify-center gap-2">
              <FileText size={18} color={colors['on-primary']} />
              <Text className="text-[16px] font-semibold text-on-primary underline">Ver recordatorio</Text>
            </Pressable>
          ) : null}
          <Pressable testID="btn-recordatorio-posponer" onPress={() => close(true)} className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-full border-2 border-on-primary/60">
            <Clock size={20} color={colors['on-primary']} />
            <Text className="text-[17px] font-semibold text-on-primary">Posponer 10 min</Text>
          </Pressable>
          <Pressable testID="btn-recordatorio-listo" onPress={() => close(false)} className="min-h-[56px] items-center justify-center rounded-full bg-on-primary">
            <Text className="text-[17px] font-bold text-primary">Listo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
