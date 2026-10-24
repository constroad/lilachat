import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Hash, Images, LayoutGrid, Settings2, UserPlus, Users, type LucideIcon } from 'lucide-react-native';
import { spaceRoleBadge, spaceSettingsRows, spaceSubtitle, type ClientWorkspace, type SpaceSettingsRow } from '@lilachat/shared';
import { FilaDeAjuste, GrupoDeAjustes } from '../ui/FilaDeAjuste';
import { Rotulo } from '../ui/Rotulo';
import { useColores } from '../ui/tema';
import { SpaceLogo } from './SpaceSwitcherSheet';

const ICONS: Record<SpaceSettingsRow['key'], LucideIcon> = { settings: Settings2, members: Users, channels: Hash, apps: LayoutGrid, invite: UserPlus, media: Images };

export type SpaceSettingsLink = SpaceSettingsRow['key'] | 'switch';

/**
 * The space open, on top of the «Ajustes» tab (José, 24/10: the space's settings belong in the
 * bottom tab; design e-34): its card and
 * what can be done in it; the account follows below.
 */
export function SpaceSettingsSection(props: { space: ClientWorkspace; apps: readonly string[]; onOpen: (link: SpaceSettingsLink) => void }) {
  const colors = useColores();
  const { space } = props;
  const badge = spaceRoleBadge(space.role);
  return (
    <View testID="ajustes-del-espacio">
      <Rotulo>{`Espacio · ${space.name}`}</Rotulo>
      <Pressable testID="ajustes-espacio-cabecera" accessibilityLabel={`${space.name}. Cambiar de espacio`} onPress={() => props.onOpen('switch')} className="mb-3 flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
        <SpaceLogo space={space} size={52} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="shrink text-[18px] font-bold text-on-surface">{space.name}</Text>
            {badge ? <View className="rounded-md bg-primary/10 px-1.5 py-0.5"><Text className="text-[12px] font-semibold text-primary">{badge}</Text></View> : null}
          </View>
          <Text numberOfLines={1} className="text-[14px] text-on-surface-variant">{spaceSubtitle(space, { membersFirst: true })}</Text>
        </View>
        <ChevronRight size={20} color={colors['on-surface-variant']} />
      </Pressable>
      <GrupoDeAjustes testID="filas-del-espacio">
        {spaceSettingsRows(space, props.apps).map((row) => (
          <FilaDeAjuste key={row.key} testID={`ajustes-espacio-${row.key}`} icono={ICONS[row.key]} titulo={row.title} detalle={row.detail} onPress={() => props.onOpen(row.key)} />
        ))}
      </GrupoDeAjustes>
    </View>
  );
}
