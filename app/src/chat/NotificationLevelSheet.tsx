import { Pressable, Text, View } from 'react-native';
import { AtSign, Bell, BellOff, type LucideIcon } from 'lucide-react-native';
import { NOTIFICATION_LEVEL_TEXT, NOTIFICATION_LEVELS, type NotificationLevel } from '@lilachat/shared';
import { Sheet } from '../ui/Sheet';
import { useColores } from '../ui/tema';

/** One icon per level, as in the design (`e-18`). */
const LEVEL_ICON: Record<NotificationLevel, LucideIcon> = { todo: Bell, menciones: AtSign, nada: BellOff };

/**
 * «Avisos de este grupo» (E3b, 20/10), like Slack: everything, only mentions
 * or nothing. Choosing one applies it and closes the sheet. The first sheet on
 * the in-window `Sheet` (plan 1, F1): drag it down to close.
 */
export function NotificationLevelSheet(props: { visible: boolean; level: NotificationLevel; onChoose: (level: NotificationLevel) => void; onClose: () => void }) {
  const palette = useColores();
  return (
    <Sheet visible={props.visible} onClose={props.onClose} testID="hoja-avisos" className="px-6">
      <Text className="mt-5 text-xl font-bold text-on-surface">Avisos de este grupo</Text>
      <Text className="mt-1 text-[15px] leading-6 text-on-surface-variant">Las llamadas siempre suenan.</Text>
      <View className="mt-4 gap-3">
        {NOTIFICATION_LEVELS.map((level) => {
          const active = level === props.level;
          const Icon = LEVEL_ICON[level];
          return (
            <Pressable
              key={level}
              testID={`avisos-${level}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => props.onChoose(level)}
              className={`min-h-[64px] flex-row items-center gap-3 rounded-2xl border px-3 ${active ? 'border-2 border-primary bg-primary/[0.06]' : 'border-outline/20'}`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-variant">
                <Icon size={20} color={active ? palette.primary : palette['on-surface-variant']} />
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className={`text-base ${active ? 'font-semibold text-primary' : 'text-on-surface'}`}>{NOTIFICATION_LEVEL_TEXT[level].title}</Text>
                  {active ? <Text className="overflow-hidden rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-on-primary">Activo</Text> : null}
                </View>
                <Text className="text-[13px] text-on-surface-variant">{NOTIFICATION_LEVEL_TEXT[level].detail}</Text>
              </View>
              <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${active ? 'border-primary' : 'border-outline/60'}`}>
                {active ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
