import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Slash } from 'lucide-react-native';
import type { CommandGroup } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';

const PANEL_MAX_HEIGHT = 300;
const APP_AVATAR = 20;
const MONO = Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' });

/**
 * «Comandos rápidos» over the bar (design `e-20-comandos-barra-app`), grouped
 * by app: the first match is the active one and shows its example. Tapping
 * one writes «/command » and leaves the keyboard open for its text.
 */
export function CommandPanel(props: { groups: readonly CommandGroup[]; onPick: (command: string) => void }) {
  const colors = useColores();
  if (props.groups.length === 0) return null;
  const first = props.groups[0]?.commands[0]?.command;
  return (
    <View testID="panel-comandos" className="border-t border-outline/10 bg-surface">
      <View className="flex-row items-center gap-2 px-4 py-2">
        <View className="h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Slash size={13} color={colors.primary} />
        </View>
        <Text className="flex-1 text-[12px] font-bold tracking-wider text-on-surface">COMANDOS RÁPIDOS</Text>
        <Text className="text-[12px] text-on-surface-variant">Toca para autocompletar</Text>
      </View>
      <ScrollView style={{ maxHeight: PANEL_MAX_HEIGHT }} keyboardShouldPersistTaps="always">
        {props.groups.map((group) => (
          <View key={group.appId}>
            <View className="flex-row items-center gap-2 px-4 pb-1 pt-2">
              <Avatar nombre={group.appName} tamano={APP_AVATAR} bot />
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{group.appName}</Text>
            </View>
            {group.commands.map((entry) => {
              const active = entry.command === first && group === props.groups[0];
              return (
                <Pressable
                  key={entry.command}
                  testID={`comando-${entry.command}`}
                  accessibilityRole="button"
                  accessibilityLabel={`/${entry.command}: ${entry.description}`}
                  onPress={() => props.onPick(entry.command)}
                  className={`min-h-[52px] justify-center px-4 py-2 ${active ? 'bg-primary/[0.07]' : ''}`}
                >
                  <Text numberOfLines={1} className="text-[15px] text-on-surface">
                    <Text className="font-semibold text-primary" style={{ fontFamily: MONO }}>{`/${entry.command}`}</Text>
                    {entry.usageHint ? <Text className="text-on-surface-variant" style={{ fontFamily: MONO }}>{` ${entry.usageHint}`}</Text> : null}
                  </Text>
                  <Text numberOfLines={1} className="mt-0.5 text-[13px] text-on-surface-variant">{entry.description}</Text>
                  {active && entry.usageHint ? (
                    <View className="mt-1.5 flex-row items-center gap-2 self-start rounded-lg border border-primary/20 bg-surface px-2 py-1">
                      <Text className="text-[12px] text-on-surface-variant">Ejemplo de uso:</Text>
                      <Text className="text-[12px] font-semibold text-primary" style={{ fontFamily: MONO }}>{`/${entry.command} ${entry.usageHint}`}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
