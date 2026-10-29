import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { ReminderDetailScreen } from './ReminderDetailScreen';
import { agendaGet, type AgendaReminder } from './agendaApi';
import { askMapsOrWaze } from './openPlace';
import { llamadaNativa, type ReminderAlarm } from '../../modules/llamada-entrante/src';
import { Modal } from '../ui/Modal';
import { AlarmScreen } from './AlarmScreen';

/**
 * The reminder big, over the lock screen, like Google Calendar (pending 63,
 * José 22/10). The native full-screen notice opens the app with it; here it is
 * shown in the guinda-and-black design (Stitch a-01/a-02) with «Descartar»
 * and «Posponer N min», and the lock is released after.
 */
export function ReminderAlarmHost(props: { jwt: string }) {
  const [alarm, setAlarm] = useState<{ reminder: ReminderAlarm; at: Date } | null>(null);
  // Pending 76: «Ver recordatorio» opens it to read the note, the image and the links.
  const [reading, setReading] = useState<string | null>(null);
  const check = useCallback(() => {
    const pending = llamadaNativa.reminderPending();
    if (pending) setAlarm({ reminder: pending, at: new Date() });
  }, []);

  // The place of the reminder that rings (José 25/10): the native alert does not carry it, so it is asked for by its id.
  const [place, setPlace] = useState<string | undefined>();
  // Its start, for «Hoy 4:00 p. m.» and the live «Empieza en …» (design a-02).
  const [startsAt, setStartsAt] = useState<string | undefined>();
  const ringingId = alarm?.reminder.id;
  useEffect(() => {
    setPlace(undefined);
    setStartsAt(undefined);
    if (!ringingId) return;
    let current = true;
    void agendaGet<{ reminder: AgendaReminder }>(`/reminders/${ringingId}`, props.jwt).then((response) => {
      if (!current || !response.ok) return;
      setPlace(response.data.reminder.location);
      setStartsAt(response.data.reminder.startsAt);
    });
    return () => {
      current = false;
    };
  }, [ringingId, props.jwt]);

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
  /** `minutes` snoozes it that long; nothing, or `false`, dismisses it. */
  const close = (minutes: number | false) => {
    if (minutes !== false && llamadaNativa.canSnoozeMinutes()) llamadaNativa.snoozeReminderFor(alarm.reminder, minutes);
    else if (minutes !== false) llamadaNativa.snoozeReminder(alarm.reminder);
    // Never left on: anyone could browse the chats of a locked phone afterwards.
    llamadaNativa.soltarBloqueo();
    setAlarm(null);
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => close(false)}>
      <AlarmScreen
        title={alarm.reminder.title}
        note={alarm.reminder.note}
        chat={alarm.reminder.chat}
        // Offline the reminder cannot be asked for: a plain one rings at its time; an early notice stays without a clock.
        startsAt={startsAt ?? (alarm.reminder.note.startsWith('Empieza en') ? undefined : alarm.at.toISOString())}
        place={place}
        canRead={Boolean(alarm.reminder.id)}
        canChooseSnooze={llamadaNativa.canSnoozeMinutes()}
        onPlace={() => place && askMapsOrWaze(place)}
        onRead={() => (setReading(alarm.reminder.id), close(false))}
        onDismiss={() => close(false)}
        onSnooze={(minutes) => close(minutes)}
      />
    </Modal>
  );
}
