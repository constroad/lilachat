import { Pressable, Text, View } from 'react-native';
import { NOTIFICATION_LEVEL_TEXT, NOTIFICATION_LEVELS, type NotificationLevel } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useMargenes } from '../ui/useMargenes';

/**
 * «Avisos de este grupo» (E3b, 20/10), like Slack: everything, only mentions
 * or nothing. Choosing one applies it and closes the sheet.
 */
export function NotificationLevelSheet(props: { visible: boolean; level: NotificationLevel; onChoose: (level: NotificationLevel) => void; onClose: () => void }) {
  const margenes = useMargenes();
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-avisos" className="rounded-t-3xl bg-surface px-6 pt-3" style={{ paddingBottom: margenes.pie + 16 }}>
        <View className="h-1.5 w-10 self-center rounded-full bg-outline/30" />
        <Text className="mt-5 text-xl font-bold text-on-surface">Avisos de este grupo</Text>
        <Text className="mt-1 text-[15px] leading-6 text-on-surface-variant">Las llamadas siempre suenan.</Text>
        <View className="mt-4">
          {NOTIFICATION_LEVELS.map((level) => {
            const active = level === props.level;
            return (
              <Pressable
                key={level}
                testID={`avisos-${level}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => props.onChoose(level)}
                className={`-mx-6 min-h-[64px] flex-row items-center justify-between gap-4 px-6 ${active ? 'bg-primary/[0.06]' : ''}`}
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-base text-on-surface">{NOTIFICATION_LEVEL_TEXT[level].title}</Text>
                  <Text className="text-[13px] text-on-surface-variant">{NOTIFICATION_LEVEL_TEXT[level].detail}</Text>
                </View>
                <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${active ? 'border-primary' : 'border-outline/60'}`}>
                  {active ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
