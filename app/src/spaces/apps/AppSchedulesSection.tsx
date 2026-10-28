import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertCircle, Clock, Trash2 } from 'lucide-react-native';
import { lastRunProblem, scheduleLine, scheduleWhere, type AppSchedules, type ScheduleRow, type SuggestedSchedule } from '@lilachat/shared';
import { Interruptor } from '../../ui/Interruptor';
import { useColores } from '../../ui/tema';
import { deleteAppSchedule, setAppScheduleActive } from '../spacesApi';

type SectionProps = { jwt: string; spaceId: string; appId: string; state: AppSchedules; onChanged: () => void; onSuggestion: (suggestion: SuggestedSchedule) => void };

/**
 * «Horarios» of an app (design d-03): the commands that run at a time and
 * post their report, how the last run went, and what the app suggests, to
 * create with one tap. The switch pauses one; only an admin changes them.
 */
export function AppSchedulesSection(props: SectionProps) {
  const { schedules, suggested, canEdit } = props.state;
  if (!schedules.length && !(canEdit && suggested.length)) return null;
  return (
    <>
      {schedules.length ? (
        <View testID="horarios-de-la-app" className="mt-4 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          <View className="flex-row items-start justify-between border-b border-outline/10 px-4 py-3">
            <View>
              <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Automatización</Text>
              <Text className="text-[16px] font-bold uppercase text-on-surface">Horarios</Text>
            </View>
            <View className="rounded-md border border-primary/30 bg-primary/10 px-2"><Text className="text-[13px] font-bold text-primary">{schedules.length}</Text></View>
          </View>
          {schedules.map((row) => <ScheduleItem key={row.id} {...props} row={row} canEdit={canEdit} />)}
        </View>
      ) : null}
      {canEdit && suggested.length ? (
        <View testID="horarios-sugeridos" className="mt-4 rounded-2xl border border-dashed border-outline/30 p-4">
          <View className="mb-3 flex-row justify-between">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Sugeridos por la app</Text>
            <Text className="text-[12px] text-on-surface-variant">{suggested.length === 1 ? '1 disponible' : `${suggested.length} disponibles`}</Text>
          </View>
          {suggested.map((suggestion, index) => (
            <View key={`${suggestion.command}-${suggestion.time}-${index}`} testID={`sugerido-${index}`} className="mb-2 flex-row items-center gap-3 rounded-xl border border-outline/15 bg-background px-3 py-2">
              <View className="min-w-0 flex-1">
                <Text className="font-mono text-[15px] text-on-surface" numberOfLines={1}>/{suggestion.command}{suggestion.text ? ` ${suggestion.text}` : ''}</Text>
                <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{scheduleLine(suggestion, '')}</Text>
              </View>
              <Pressable testID={`crear-sugerido-${index}`} onPress={() => props.onSuggestion(suggestion)} className="min-h-[40px] justify-center rounded-lg border border-primary px-3">
                <Text className="text-[15px] font-semibold text-primary">Crear</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

function ScheduleItem(props: SectionProps & { row: ScheduleRow; canEdit: boolean }) {
  const colors = useColores();
  const { row } = props;
  const [active, setActive] = useState(row.active);
  const [error, setError] = useState<string | null>(null);
  const problem = lastRunProblem(row.lastRun);
  const toggle = async (next: boolean) => {
    setActive(next);
    const result = await setAppScheduleActive(props.jwt, props.spaceId, props.appId, row.id, next);
    if (!result.ok) {
      setActive(!next);
      setError(result.message ?? 'No se pudo cambiar.');
    }
  };
  const remove = async () => {
    const result = await deleteAppSchedule(props.jwt, props.spaceId, props.appId, row.id);
    if (!result.ok) return setError(result.message ?? 'No se pudo borrar.');
    props.onChanged();
  };
  return (
    <View testID={`horario-${row.id}`} className={`flex-row items-center gap-3 border-b border-outline/10 px-4 py-3 ${problem ? 'bg-error/5' : ''}`}>
      <View className="h-10 w-10 items-center justify-center rounded-lg border border-outline/15 bg-primary/5"><Clock size={18} color={colors.primary} /></View>
      <View className="min-w-0 flex-1">
        <Text className="font-mono text-[16px] text-on-surface" numberOfLines={1}>/{row.command}{row.text ? ` ${row.text}` : ''}</Text>
        <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{scheduleLine(row, scheduleWhere(row.where))}</Text>
        {problem ? (
          <View testID={`horario-error-${row.id}`} className="mt-0.5 flex-row items-center gap-1">
            <AlertCircle size={13} color={colors.error} />
            <Text className="flex-1 text-[12px] font-semibold text-error">{problem}</Text>
          </View>
        ) : null}
        {error ? <Text className="text-[12px] text-error">{error}</Text> : null}
      </View>
      {props.canEdit ? <Pressable testID={`borrar-horario-${row.id}`} accessibilityLabel={`Borrar el horario de /${row.command}`} onPress={() => void remove()} className="h-10 w-10 items-center justify-center"><Trash2 size={17} color={colors['on-surface-variant']} /></Pressable> : null}
      <Interruptor testID={`activo-${row.id}`} value={active} disabled={!props.canEdit} onValueChange={(next) => void toggle(next)} />
    </View>
  );
}
