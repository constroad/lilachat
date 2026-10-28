import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, Info, MoreVertical } from 'lucide-react-native';
import type { DirectoryApp } from '@lilachat/shared';
import { HeaderDropdown } from '../../chat/HeaderDropdown';
import type { ChatHeaderMenu } from '../../chat/useChatHeaderMenu';
import { Segmentado } from '../../ui/Segmentado';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { appDirectoryCache, appDirectoryKey, fetchAppDirectory, useCached } from '../spaceCache';
import { useSpaceName } from '../currentSpace';
import { AppBadge, AppLogo } from './AppLogo';
import { AppDetailScreen } from './AppDetailScreen';
import { useSpaceApps } from './useSpaceApps';

const HEADER_LOGO_SIZE = 40;
/** The 1:1 is already open: «Mensaje» in its detail goes back to it, not to another chat. */
const STAY_IN_CHAT = () => undefined;
const CHAT_MENU_RIGHT = 8;
type AppTab = 'messages' | 'info';
const TABS = [
  { key: 'messages', etiqueta: 'Mensajes', testID: 'pestana-app-messages' },
  { key: 'info', etiqueta: 'Información', testID: 'pestana-app-info' },
] as const;

/** Which app a 1:1 is with, from the space's directory (what the list already read paints at once). */
export function useAppOfChat(params: { appId?: string; spaceId?: string; jwt: string }): DirectoryApp | null {
  const key = params.appId && params.spaceId ? appDirectoryKey(params.spaceId) : null;
  const entry = useCached(appDirectoryCache, key, params.spaceId ? fetchAppDirectory(params.jwt, params.spaceId) : () => Promise.reject(new Error('sin espacio')));
  return entry.value?.apps.find((app) => app.appId === params.appId) ?? null;
}

/**
 * The head of a 1:1 with an app (design e-26): its square logo, «APP», who
 * made it, and the tabs «Mensajes» and «Información» (the one detail of
 * the app, pending 99, the same as from the directory). No
 * calls: an app is not called. The ⋮ keeps the chat's options (search, mute),
 * which the design leaves out but a noisy app needs.
 */
export function AppChatHeader(props: { app: DirectoryApp; spaceId?: string; jwt?: string; connected: boolean; menu: ChatHeaderMenu; onBack: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const spaceName = useSpaceName(props.spaceId);
  const [tab, setTab] = useState<AppTab>('messages');
  const [menuOpen, setMenuOpen] = useState(false);
  // The same detail as from the directory (pending 99): an admin reinstalls or uninstalls it from here too.
  const apps = useSpaceApps({ jwt: props.jwt ?? '', spaceId: props.spaceId ?? null, active: false, onChat: STAY_IN_CHAT });
  const admin = apps.directory?.canInstall ?? false;
  const { app } = props;
  return (
    <View testID="cabecera-app" className="border-b border-outline/10 bg-surface px-3 pb-2" style={{ paddingTop: margins.cabecera }}>
      <View className="flex-row items-center gap-2">
        <Pressable onPress={props.onBack} testID="btn-volver" className="h-11 w-11 items-center justify-center">
          <ArrowLeft size={22} color={colors['on-surface']} />
        </Pressable>
        <AppLogo avatarUrl={app.avatarUrl} size={HEADER_LOGO_SIZE} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text numberOfLines={1} className="shrink text-base font-bold text-on-surface">{app.name}</Text>
            <AppBadge />
          </View>
          <Text testID={props.connected ? undefined : 'estado-conexion'} numberOfLines={1} className="text-xs text-on-surface-variant">{props.connected ? (app.developer ? `de ${app.developer}` : 'App del espacio') : 'Conectando…'}</Text>
        </View>
        <Pressable testID="btn-info-app" accessibilityLabel={`Información de ${app.name}`} onPress={() => setTab('info')} className="h-11 w-11 items-center justify-center">
          <Info size={21} color={colors['on-surface-variant']} />
        </Pressable>
        <Pressable testID="btn-menu-chat" accessibilityLabel="Más opciones" onPress={() => { props.menu.refresh(); setMenuOpen(true); }} className="h-11 w-9 items-center justify-center">
          <MoreVertical size={20} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      <View className="mt-2">
        <Segmentado opciones={TABS} valor={tab} onCambiar={setTab} />
      </View>
      <HeaderDropdown testID="menu-del-chat" visible={menuOpen} options={props.menu.options} right={CHAT_MENU_RIGHT} onSelect={props.menu.select} onClose={() => setMenuOpen(false)} />
      {tab === 'info' && props.jwt && props.spaceId ? (
        <AppDetailScreen
          app={app}
          jwt={props.jwt}
          spaceId={props.spaceId}
          spaceName={spaceName}
          admin={admin}
          uninstalling={apps.uninstallingId === app.appId}
          onClose={() => setTab('messages')}
          onMessage={() => setTab('messages')}
          onInstall={() => apps.install(app)}
          onUninstall={admin ? () => apps.uninstall(app) : undefined}
        />
      ) : null}
    </View>
  );
}
