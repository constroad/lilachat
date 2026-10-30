import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Circle, CircleCheck, Clock } from 'lucide-react-native';
import { serviceStages, stagesDone, type ServiceDetail, type StageState } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/**
 * Where the service stands, read from Portal (José 30/10: how to measure what
 * is done and what is pending without ticking a checklist by hand). It folds
 * inside the progress card (José 30/10 night: «con un toggle»); closed by default.
 */
export function ServiceStages({ detail }: { detail: ServiceDetail }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const stages = serviceStages(detail);
  const progress = stagesDone(stages);
  const iconOf = (state: StageState) =>
    state === 'done' ? <CircleCheck size={18} color={colors['en-linea']} /> : state === 'doing' ? <Clock size={18} color={colors.warning} /> : <Circle size={18} color={colors.outline} />;
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View testID="etapas-servicio" className="mt-3 border-t border-outline/10 pt-1">
      <Pressable testID="etapas-toggle" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} className="min-h-[40px] flex-row items-center gap-2">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{`Etapas · ${progress.done} de ${progress.total}`}</Text>
        <Chevron size={18} color={colors['on-surface-variant']} />
      </Pressable>
      {open
        ? stages.map((stage) => (
            <View key={stage.key} testID={`etapa-${stage.key}-${stage.state}`} className="min-h-[40px] flex-row items-center gap-3">
              {iconOf(stage.state)}
              <Text className="w-24 text-[14px] font-semibold text-on-surface">{stage.label}</Text>
              <Text numberOfLines={1} className="flex-1 text-[13px] text-on-surface-variant">{stage.line}</Text>
            </View>
          ))
        : null}
    </View>
  );
}
