import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CHECKLIST_SEGMENT_LABELS, type ChecklistSegment } from '@lilachat/shared';

const SEGMENTS: ChecklistSegment[] = ['pending', 'plan'];

/**
 * «Checklist» on a phone (José 19/11, design cc-06): «Pendientes · Plan» in one segmented control,
 * the open tasks first. «Pendientes» stops being a tab of its own there.
 */
export function ChecklistSegments(props: { counts: Record<ChecklistSegment, string>; pending: ReactNode; plan: ReactNode }) {
  const [segment, setSegment] = useState<ChecklistSegment>('pending');
  return (
    <View testID="checklist-segmentos" className="flex-1">
      <View accessibilityRole="tablist" className="mx-4 mt-3 flex-row rounded-xl border border-outline/15 bg-surface-variant/50 p-1">
        {SEGMENTS.map((key) => {
          const on = segment === key;
          return (
            <Pressable key={key} testID={`checklist-segmento-${key}`} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setSegment(key)} className={`min-h-[40px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${on ? 'bg-surface' : ''}`}>
              <Text className={`text-[14px] font-semibold ${on ? 'text-primary' : 'text-on-surface-variant'}`}>{CHECKLIST_SEGMENT_LABELS[key]}</Text>
              {props.counts[key] ? <Text className={`text-[12px] ${on ? 'text-primary' : 'text-on-surface-variant'}`}>{props.counts[key]}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View className="flex-1">{segment === 'pending' ? props.pending : props.plan}</View>
    </View>
  );
}
