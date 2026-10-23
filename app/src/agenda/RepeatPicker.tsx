import { Pressable, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { describeRepeat, formatClock, limaMonthDay, limaWeekday, type Recurrence, type RepeatRule } from '@lilachat/shared';
import { useColores } from '../ui/tema';

const OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'once', label: 'Una vez' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];
/** Monday first, as the week is read in Peru; the value is `Date.getDay`. */
const WEEK: { day: number; letter: string; name: string }[] = [
  { day: 1, letter: 'L', name: 'lunes' },
  { day: 2, letter: 'M', name: 'martes' },
  { day: 3, letter: 'M', name: 'miércoles' },
  { day: 4, letter: 'J', name: 'jueves' },
  { day: 5, letter: 'V', name: 'viernes' },
  { day: 6, letter: 'S', name: 'sábado' },
  { day: 0, letter: 'D', name: 'domingo' },
];
const UNIT: Partial<Record<Recurrence, [string, string]>> = { daily: ['día', 'días'], weekly: ['semana', 'semanas'], monthly: ['mes', 'meses'] };
const MAX_EVERY = 99;

/**
 * «Repetir» of a reminder (pending 65, José 22/10; design `r150-repetir`): once,
 * daily, weekly on chosen days (Tuesdays and Thursdays), monthly on its day or
 * on the last one (28, 29, 30 or 31), every N, and the sentence that says it.
 */
export function RepeatPicker(props: { recurrence: Recurrence; rule: RepeatRule | undefined; startsAt: Date; onChange: (recurrence: Recurrence, rule: RepeatRule | undefined) => void }) {
  const colors = useColores();
  const { recurrence, rule, startsAt } = props;
  const every = rule?.every ?? 1;
  const choose = (next: Recurrence) => {
    if (next === 'weekly') return props.onChange(next, { weekdays: rule?.weekdays?.length ? rule.weekdays : [limaWeekday(startsAt)] });
    if (next === 'monthly') return props.onChange(next, { monthDay: rule?.monthDay ?? 'same', day: limaMonthDay(startsAt) });
    props.onChange(next, undefined);
  };
  const toggleDay = (day: number) => {
    const days = rule?.weekdays ?? [];
    const next = days.includes(day) ? days.filter((one) => one !== day) : [...days, day];
    // At least one day: an empty week would never ring.
    if (next.length) props.onChange('weekly', { ...rule, weekdays: next });
  };
  const setEvery = (value: number) => props.onChange(recurrence, { ...rule, every: Math.min(MAX_EVERY, Math.max(1, value)) });
  const summary = describeRepeat(recurrence, rule, formatClock(startsAt), limaMonthDay(startsAt));
  const unit = UNIT[recurrence];

  return (
    <View>
      <View className="flex-row rounded-xl bg-primary/[0.07] p-1">
        {OPTIONS.map((option) => (
          <Pressable key={option.value} testID={`recurrencia-${option.value}`} accessibilityRole="tab" accessibilityState={{ selected: recurrence === option.value }} onPress={() => choose(option.value)} className={`min-h-[40px] flex-1 items-center justify-center rounded-lg ${recurrence === option.value ? 'bg-surface' : ''}`}>
            <Text className={`text-[13px] font-semibold ${recurrence === option.value ? 'text-primary' : 'text-on-surface-variant'}`}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      {recurrence === 'weekly' ? (
        <View className="mt-3 rounded-xl border border-outline/15 bg-surface p-3">
          <Text className="text-[13px] text-on-surface-variant">Días de la semana:</Text>
          <View className="mt-2 flex-row justify-between">
            {WEEK.map(({ day, letter, name }) => {
              const on = Boolean(rule?.weekdays?.includes(day));
              return (
                <Pressable key={day} testID={`dia-${day}`} accessibilityLabel={name} accessibilityState={{ selected: on }} onPress={() => toggleDay(day)} className={`h-10 w-10 items-center justify-center rounded-full border ${on ? 'border-primary bg-primary' : 'border-outline/30'}`}>
                  <Text className={`text-[14px] font-semibold ${on ? 'text-on-primary' : 'text-on-surface'}`}>{letter}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {recurrence === 'monthly' ? (
        <View className="mt-3 rounded-xl border border-outline/15 bg-surface">
          {([['same', `El día ${limaMonthDay(startsAt)} de cada mes`], ['last', 'El último día del mes (28, 29, 30 o 31)']] as const).map(([value, label]) => {
            const on = (rule?.monthDay ?? 'same') === value;
            return (
              <Pressable key={value} testID={`mensual-${value}`} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => props.onChange('monthly', { ...rule, monthDay: value, day: limaMonthDay(startsAt) })} className="min-h-[48px] flex-row items-center gap-3 border-b border-outline/10 px-3">
                <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${on ? 'border-primary' : 'border-outline/40'}`}>{on ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}</View>
                <Text className="flex-1 text-[14px] text-on-surface">{label}</Text>
              </Pressable>
            );
          })}
          <Text className="px-3 pb-2 pt-1 text-[12px] text-on-surface-variant">El último día es también «el día antes del 1 del mes siguiente».</Text>
        </View>
      ) : null}

      {unit ? (
        <View className="mt-3 flex-row items-center gap-3">
          <Text className="text-[14px] text-on-surface">Cada</Text>
          <Pressable testID="cada-menos" accessibilityLabel="Menos" onPress={() => setEvery(every - 1)} className="h-9 w-9 items-center justify-center rounded-full bg-primary/[0.07]">
            <Minus size={16} color={colors['on-surface']} />
          </Pressable>
          <Text testID="cada-valor" className="min-w-[24px] text-center text-[15px] font-semibold text-on-surface">{every}</Text>
          <Pressable testID="cada-mas" accessibilityLabel="Más" onPress={() => setEvery(every + 1)} className="h-9 w-9 items-center justify-center rounded-full bg-primary/[0.07]">
            <Plus size={16} color={colors['on-surface']} />
          </Pressable>
          <Text className="text-[14px] text-on-surface">{every === 1 ? unit[0] : unit[1]}</Text>
        </View>
      ) : null}

      {summary ? <Text testID="resumen-repetir" className="mt-2 text-[13px] text-on-surface-variant">{summary}</Text> : null}
    </View>
  );
}
