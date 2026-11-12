import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock } from 'lucide-react-native';
import { combinarFecha, formatFormDate, parseFormDate, type FormField } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ErrorLine, Label } from './AppFormFields';

type DateFieldDefinition = Extract<FormField, { kind: 'date' }>;

const DAY = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
/** 24 hours: the value is `HH:MM` and the box says the same. */
const CLOCK = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * A day, an hour or both, chosen with the system picker and never typed
 * (José, 24/10: «un selector de fecha, no un input»). The form opens a date
 * on today and a moment on now; an hour waits for the person. The value is
 * what the app's schema reads: `2026-10-24`, `07:30`, `2026-10-24T07:30`.
 */
export function DateField(props: { field: DateFieldDefinition; value: unknown; error?: string; onChange: (value: unknown) => void; /** Half a row beside another field. */ compact?: boolean }) {
  const { field } = props;
  const colors = useColores();
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const current = parseFormDate(props.value, field.mode);
  const withDay = field.mode !== 'time';
  const withHour = field.mode !== 'date';
  const onPicked = (event: DateTimePickerEvent, chosen?: Date) => {
    const which = picker;
    setPicker(null);
    if (event.type !== 'set' || !chosen || !which) return;
    props.onChange(formatFormDate(field.mode === 'date-time' ? combinarFecha(current ?? new Date(), chosen, which) : chosen, field.mode));
  };
  return (
    <View>
      <Label field={field} />
      <View className="flex-row gap-2">
        {withDay ? <PickerBox testID={withHour ? `campo-${field.name}-dia` : `campo-${field.name}`} icon={<CalendarDays size={18} color={colors.primary} />} text={current ? DAY.format(current).replace(/\./g, '') : 'Elige el día'} empty={!current} onPress={() => setPicker('date')} /> : null}
        {withHour ? <PickerBox testID={withDay ? `campo-${field.name}-hora` : `campo-${field.name}`} icon={<Clock size={18} color={colors.primary} />} text={current ? CLOCK.format(current) : 'Elige la hora'} empty={!current} onPress={() => setPicker('time')} /> : null}
      </View>
      {picker ? <DateTimePicker value={current ?? new Date()} mode={picker} is24Hour onChange={onPicked} /> : null}
      {field.help ? <Text className="mt-1 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      <ErrorLine text={props.error} />
    </View>
  );
}

/**
 * The box that opens the picker, drawn like the form's other inputs (José 12/11: the tinted
 * «Día» tile beside «Responsable» looked out of place): same border, height and text size.
 */
function PickerBox(props: { testID: string; icon: ReactNode; text: string; empty: boolean; onPress: () => void }) {
  return (
    <Pressable testID={props.testID} accessibilityRole="button" onPress={props.onPress} className="min-h-[48px] flex-1 flex-row items-center gap-2 rounded-xl border border-outline/25 bg-background px-3">
      {props.icon}
      <Text className={`min-w-0 flex-1 text-[16px] ${props.empty ? 'text-on-surface-variant' : 'text-on-surface'}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{props.text}</Text>
    </Pressable>
  );
}
