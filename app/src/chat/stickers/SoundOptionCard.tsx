import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Play, Square, type LucideIcon } from 'lucide-react-native';
import { useColores } from '../../ui/tema';

const ICON_BOX = 44;

/** One choice of the sheet: a card with its icon, its words and the radio (design ss-02). */
export function SoundOption(props: { testID: string; Icon: LucideIcon; title: string; badge?: string; selected: boolean; onPress: () => void; detail?: ReactNode; children?: ReactNode }) {
  const colors = useColores();
  const { Icon } = props;
  return (
    <View className={`overflow-hidden rounded-2xl border-2 ${props.selected ? 'border-primary' : 'border-outline/15'}`}>
      <Pressable testID={props.testID} accessibilityRole="radio" accessibilityState={{ checked: props.selected }} onPress={props.onPress} className="min-h-[64px] flex-row items-center gap-3 px-3 py-2.5">
        <View className={`items-center justify-center rounded-xl ${props.selected ? 'bg-primary/15' : 'bg-background'}`} style={{ width: ICON_BOX, height: ICON_BOX }}>
          <Icon size={20} color={props.selected ? colors.primary : colors['on-surface-variant']} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[15px] font-semibold text-on-surface">{props.title}</Text>
            {props.badge ? <Text className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">{props.badge}</Text> : null}
          </View>
          {props.detail}
        </View>
        <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${props.selected ? 'border-primary' : 'border-outline/40'}`}>
          {props.selected ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
        </View>
      </Pressable>
      {props.selected && props.children ? <View className="px-3 pb-3">{props.children}</View> : null}
    </View>
  );
}

/** «▶ 0:06»: listen to a sound without leaving the sheet; «■ Sonando…» while it plays, and a tap stops it. */
export function ListenChip(props: { testID: string; label: string; onPress: () => void; playing?: boolean }) {
  const colors = useColores();
  const Icon = props.playing ? Square : Play;
  return (
    <Pressable testID={props.testID} accessibilityRole="button" accessibilityLabel={props.playing ? 'Detener' : `Escuchar ${props.label}`} accessibilityState={{ selected: Boolean(props.playing) }} onPress={props.onPress} hitSlop={12} className="mt-0.5 flex-row items-center gap-1.5 self-start">
      <View className="h-5 w-5 items-center justify-center rounded-full bg-primary"><Icon size={10} color={colors['on-primary']} fill={props.playing ? colors['on-primary'] : 'none'} /></View>
      <Text numberOfLines={1} className="text-[13px] font-semibold text-primary">{props.playing ? 'Sonando… toca para detener' : props.label}</Text>
    </Pressable>
  );
}
