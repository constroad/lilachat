import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Check, Clock } from 'lucide-react-native';
import { repeatOfDays, scheduleRequestOf, validateScheduleInput, weekdaysOf, type ScheduleRepeat } from '@lilachat/shared';
import { Interruptor } from '../../ui/Interruptor';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { createAppSchedule, type AppItems } from '../spacesApi';
import { SaveButton } from './AppSettingsSections';

/** What «Programar» opens with: a command alone, or an app's suggestion with its hour and days. */
export type ScheduleDraft = { command: string; shareable: boolean; text?: string; time?: string; repeat?: ScheduleRepeat; onlyIfSomething?: boolean };

type SheetProps = { jwt: string; spaceId: string; appId: string; appName: string; draft: ScheduleDraft; channels: AppItems['channels']; onClose: () => void; onCreated: () => void };

const DEFAULT_TIME = '08:00';
/** Monday first, as the week is read in Peru; 0 = Sunday. */
const WEEK: readonly [number, string][] = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const DIRECT = 'direct';
const pad = (value: number) => String(value).padStart(2, '0');
const dateAt = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours ?? 8, minutes ?? 0, 0, 0);
  return date;
};

/**
 * «Programar» (design d-02): a read command that runs as the admin at the
 * hour and days picked and posts its report in a channel, or only in their 1:1
 * with the app when it carries amounts. The server checks it all again.
 */
export function ScheduleSheet(props: SheetProps) {
  const colors = useColores();
  const margins = useMargenes();
  const { draft } = props;
  const [time, setTime] = useState(draft.time ?? DEFAULT_TIME);
  const [picking, setPicking] = useState(false);
  const [days, setDays] = useState<number[]>(weekdaysOf(draft.repeat ?? { every: 1 }));
  const [where, setWhere] = useState(draft.shareable ? (props.channels[0]?.id ?? DIRECT) : DIRECT);
  const [text, setText] = useState(draft.text ?? '');
  const [onlyIfSomething, setOnlyIfSomething] = useState(draft.onlyIfSomething ?? false);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const places = [...(draft.shareable ? props.channels.map((channel) => ({ id: channel.id, label: `# ${channel.name}` })) : []), { id: DIRECT, label: `Tu chat con ${props.appName}` }];

  const onPicked = (event: DateTimePickerEvent, chosen?: Date) => {
    setPicking(false);
    if (event.type === 'set' && chosen) setTime(`${pad(chosen.getHours())}:${pad(chosen.getMinutes())}`);
  };
  const toggleDay = (day: number) => setDays((before) => (before.includes(day) ? before.filter((one) => one !== day) : [...before, day]));
  const submit = async () => {
    const valid = validateScheduleInput({ command: draft.command, text, time, repeat: repeatOfDays(days), chat_id: where, only_if_something: onlyIfSomething });
    if (!valid.ok) return setState({ busy: false, error: valid.message });
    setState({ busy: true });
    const result = await createAppSchedule(props.jwt, props.spaceId, props.appId, scheduleRequestOf(valid.input));
    if (!result.ok) return setState({ busy: false, error: result.message ?? 'No se pudo programar.' });
    props.onCreated();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => !text && props.onClose()}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
        <View testID="hoja-programar" className="max-h-[92%] rounded-t-3xl bg-surface" style={{ paddingBottom: margins.pie + 8 }}>
          <View className="mt-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Programar</Text>
              <Text className="text-[20px] font-bold text-on-surface">/{draft.command} de {props.appName}</Text>
              <Text className="mt-1 text-[14px] text-on-surface-variant">Corre como tú, a la hora que elijas, y publica el reporte {draft.shareable ? 'en el canal' : 'en tu chat con la app'}.</Text>
            </View>
            <Box title="Hora de ejecución">
              <Pressable testID="programar-hora" onPress={() => setPicking(true)} className="min-h-[56px] flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl border border-outline/15 bg-primary/5"><Clock size={20} color={colors.primary} /></View>
                <Text className="flex-1 font-mono text-[30px] text-on-surface">{time}</Text>
                <Text className="text-[15px] font-semibold text-primary">Cambiar</Text>
              </Pressable>
            </Box>
            <Box title="Días repetidos" aside={`${days.length} ${days.length === 1 ? 'día activo' : 'días activos'}`}>
              <View className="flex-row justify-between">
                {WEEK.map(([day, letter]) => (
                  <Pressable key={day} testID={`dia-${day}`} accessibilityState={{ selected: days.includes(day) }} onPress={() => toggleDay(day)} className={`h-11 w-11 items-center justify-center rounded-full ${days.includes(day) ? 'bg-primary' : 'border border-outline/25'}`}>
                    <Text className={`text-[15px] font-bold ${days.includes(day) ? 'text-on-primary' : 'text-on-surface-variant'}`}>{letter}</Text>
                  </Pressable>
                ))}
              </View>
            </Box>
            <Box title="Dónde se publica">
              {places.map((place) => (
                <Pressable key={place.id} testID={`programar-donde-${place.id === DIRECT ? 'directo' : place.label.slice(2)}`} onPress={() => setWhere(place.id)} className="min-h-[44px] flex-row items-center border-b border-outline/10">
                  <Text className={`flex-1 text-[15px] ${where === place.id ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>{place.label}</Text>
                  {where === place.id ? <Check size={18} color={colors.primary} /> : null}
                </Pressable>
              ))}
              {draft.shareable ? null : <Text className="mt-2 text-[13px] text-on-surface-variant">Los comandos con montos solo se programan en tu chat con la app.</Text>}
            </Box>
            <Box title="Argumentos (opcional)">
              <TextInput testID="programar-texto" value={text} onChangeText={setText} maxLength={200} placeholder="ayer, lunes, 2026-10-28…" placeholderTextColor={colors['on-surface-variant']} className="min-h-[44px] rounded-xl border border-outline/25 px-3 font-mono text-[15px] text-on-surface" />
              <Text className="mt-1 text-[12px] text-on-surface-variant">Lo que escribirías después del comando.</Text>
            </Box>
            <View className="min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-outline/15 px-4 py-3">
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-on-surface">Solo si hay algo que reportar</Text>
                <Text className="text-[12px] text-on-surface-variant">Si la app no tiene nada nuevo, no se publica nada.</Text>
              </View>
              <Interruptor testID="programar-solo-si-hay-algo" value={onlyIfSomething} onValueChange={setOnlyIfSomething} />
            </View>
            {state.error ? <Text testID="error-programar" className="text-[13px] text-error">{state.error}</Text> : null}
            <View className="flex-row"><SaveButton testID="btn-programar" disabled={false} busy={state.busy} onPress={() => void submit()} label="Programar" /></View>
            <Pressable testID="btn-cancelar-programar" onPress={props.onClose} className="min-h-[44px] items-center justify-center"><Text className="text-[15px] text-on-surface-variant">Cancelar</Text></Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      {picking ? <DateTimePicker value={dateAt(time)} mode="time" is24Hour onChange={onPicked} /> : null}
    </Modal>
  );
}

function Box(props: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-outline/15 p-4">
      <View className="mb-2 flex-row justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{props.title}</Text>
        {props.aside ? <Text className="text-[12px] text-primary">{props.aside}</Text> : null}
      </View>
      {props.children}
    </View>
  );
}
