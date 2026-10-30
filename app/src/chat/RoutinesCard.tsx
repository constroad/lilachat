import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ROUTINE_NOTE_MAX, quietHoursLabel, quietHoursOf, type ContactNote, type QuietHours } from '@lilachat/shared';
import { Interruptor } from '../ui/Interruptor';
import { saveRoutines } from './routinesApi';

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DEFAULT_QUIET = { days: [1, 2, 3, 4, 5], from: '18:00', to: '08:00' };
type Edge = 'from' | 'to';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';
const clockOf = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const dateOf = (clock: string) => {
  const date = new Date();
  date.setHours(Number(clock.slice(0, 2)), Number(clock.slice(3, 5)), 0, 0);
  return date;
};

/**
 * «Automatizaciones» of one chat (pending 17, design `automatizaciones`), only
 * mine: «Silenciar por horario» (no push while it runs, calls still ring) and,
 * in a 1:1, «Recordar la próxima vez que hables». Saved on the server.
 */
export function RoutinesCard(props: { chatId: string; jwt: string; isDirect: boolean; name: string; quietHours?: QuietHours; contactNote?: ContactNote }) {
  const [quiet, setQuiet] = useState<QuietHours | null>(props.quietHours ?? null);
  const [note, setNote] = useState(props.contactNote?.text ?? '');
  const [savedNote, setSavedNote] = useState(props.contactNote?.text ?? '');
  const [picking, setPicking] = useState<Edge | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setQuiet(props.quietHours ?? null);
  }, [props.quietHours]);

  const saveQuiet = async (next: QuietHours | null) => {
    const before = quiet;
    setQuiet(next);
    const failed = await saveRoutines(props.jwt, props.chatId, { quietHours: next });
    setError(failed ?? '');
    if (failed) setQuiet(before);
  };
  const change = (patch: Partial<QuietHours>) => {
    const next = quiet && quietHoursOf({ ...quiet, ...patch });
    if (next) void saveQuiet(next);
  };
  const toggleDay = (day: number) => quiet && change({ days: quiet.days.includes(day) ? quiet.days.filter((one) => one !== day) : [...quiet.days, day] });
  const onPick = (event: DateTimePickerEvent, picked?: Date) => {
    const edge = picking;
    setPicking(null);
    if (event.type === 'set' && picked && edge) change({ [edge]: clockOf(picked) });
  };
  const saveNote = async (text: string) => {
    const failed = await saveRoutines(props.jwt, props.chatId, { contactNote: text.trim() ? { text: text.trim() } : null });
    setError(failed ?? '');
    if (!failed) setSavedNote(text.trim());
  };

  return (
    <View testID="tarjeta-rutinas" className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface p-4">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Automatizaciones</Text>
      <View className="mt-3 min-h-[52px] flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold text-on-surface">Silenciar por horario</Text>
          <Text className="text-[13px] text-on-surface-variant">{quiet ? quietHoursLabel(quiet) : 'Sin avisos en tus horas de descanso. Las llamadas suenan igual.'}</Text>
        </View>
        <Interruptor testID="switch-silencio-horario" value={quiet !== null} onValueChange={(on) => void saveQuiet(on ? { ...DEFAULT_QUIET, tz: zone() } : null)} />
      </View>
      {quiet ? (
        <View className="mt-2 gap-3">
          <View className="flex-row gap-1.5">
            {DAY_LETTERS.map((letter, day) => (
              <Pressable key={day} testID={`dia-silencio-${day}`} accessibilityRole="button" accessibilityState={{ selected: quiet.days.includes(day) }} onPress={() => toggleDay(day)} className={`h-9 w-9 items-center justify-center rounded-full border ${quiet.days.includes(day) ? 'border-primary bg-primary/10' : 'border-outline/20'}`}>
                <Text className={`text-[13px] ${quiet.days.includes(day) ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>{letter}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-3">
            {(['from', 'to'] as const).map((edge) => (
              <Pressable key={edge} testID={`hora-silencio-${edge}`} onPress={() => setPicking(edge)} className="min-h-[44px] flex-1 justify-center rounded-xl border border-outline/20 px-3">
                <Text className="text-[12px] text-on-surface-variant">{edge === 'from' ? 'Desde' : 'Hasta'}</Text>
                <Text className="text-[15px] font-semibold text-on-surface">{quiet[edge]}</Text>
              </Pressable>
            ))}
          </View>
          {picking ? <DateTimePicker value={dateOf(quiet[picking])} mode="time" is24Hour onChange={onPick} /> : null}
        </View>
      ) : null}
      {props.isDirect ? (
        <View className="mt-4 border-t border-outline/10 pt-3">
          <Text className="text-[15px] font-semibold text-on-surface">Recordar la próxima vez que hables con {props.name}</Text>
          <TextInput testID="nota-contacto" value={note} onChangeText={setNote} maxLength={ROUTINE_NOTE_MAX} placeholder="Ej.: preguntarle por la factura" className="mt-2 min-h-[44px] rounded-xl border border-outline/20 px-3 text-[15px] text-on-surface" />
          {note.trim() !== savedNote ? (
            <Pressable testID="btn-guardar-nota" onPress={() => void saveNote(note)} className="mt-2 h-10 items-center justify-center rounded-xl bg-primary">
              <Text className="text-[14px] font-semibold text-on-primary">{note.trim() ? 'Guardar recordatorio' : 'Quitar recordatorio'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {error ? <Text className="mt-2 text-[13px] text-error">{error}</Text> : null}
    </View>
  );
}
