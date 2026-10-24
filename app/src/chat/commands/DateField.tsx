import { useState } from 'react';
import { Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock } from 'lucide-react-native';
import { combinarFecha, formatFormDate, parseFormDate, type FormField } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { Casilla } from '../../ui/SelectorDeCuando';
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
export function DateField(props: { field: DateFieldDefinition; value: unknown; error?: string; onChange: (value: unknown) => void }) {
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
        {withDay ? <Casilla testID={withHour ? `campo-${field.name}-dia` : `campo-${field.name}`} icono={<CalendarDays size={18} color={colors.primary} />} rotulo="Día" valor={current ? DAY.format(current).replace('.', '') : 'Elige el día'} vacio={!current} onPress={() => setPicker('date')} /> : null}
        {withHour ? <Casilla testID={withDay ? `campo-${field.name}-hora` : `campo-${field.name}`} icono={<Clock size={18} color={colors.primary} />} rotulo="Hora" valor={current ? CLOCK.format(current) : 'Elige la hora'} vacio={!current} onPress={() => setPicker('time')} /> : null}
      </View>
      {picker ? <DateTimePicker value={current ?? new Date()} mode={picker} is24Hour onChange={onPicked} /> : null}
      {field.help ? <Text className="mt-1 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      <ErrorLine text={props.error} />
    </View>
  );
}
