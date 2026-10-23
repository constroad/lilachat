import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { ShortcutRow } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { AppLogo } from '../../spaces/apps/AppLogo';

const LOGO = 40;

/** The apps' actions as rows (designs e-29 and e-30): the app's logo, the action, the app, a chevron. */
export function AppActionRows(props: { rows: readonly ShortcutRow[]; onPick: (row: ShortcutRow) => void; testPrefix: string }) {
  const colors = useColores();
  return (
    <View className="overflow-hidden rounded-2xl border border-outline/15">
      {props.rows.map((row, index) => (
        <Pressable key={`${row.appId}:${row.kind}:${row.key}`} testID={`${props.testPrefix}-${row.key}`} onPress={() => props.onPick(row)} className={`min-h-[64px] flex-row items-center gap-3 px-3 py-2.5 ${index > 0 ? 'border-t border-outline/10' : ''}`}>
          <AppLogo avatarUrl={row.avatarUrl} size={LOGO} />
          <View className="min-w-0 flex-1">
            <Text className="text-[16px] font-semibold text-on-surface" numberOfLines={1}>{row.name}</Text>
            <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{row.appName}</Text>
          </View>
          <ChevronRight size={18} color={colors['on-surface-variant']} />
        </Pressable>
      ))}
    </View>
  );
}
