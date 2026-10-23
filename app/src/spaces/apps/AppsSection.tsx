import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronRight, LayoutGrid, Plus } from 'lucide-react-native';
import { installedWithoutChat, type DirectoryApp } from '@lilachat/shared';
import type { ChatSummary } from '../../api/client';
import { useColores } from '../../ui/tema';
import { AppBadge, AppLogo } from './AppLogo';
import type { SpaceApps } from './useSpaceApps';

/** The same side as a chat's avatar in the list (`FilaDeChat`). */
const ROW_LOGO_SIZE = 50;

/**
 * «Apps» in the space's list (design e-23, like Slack's): the 1:1s with apps
 * (drawn by the list, as compact as the direct messages), then the installed
 * apps not talked to yet. The grid and «+» open the directory (e-24).
 */
export function AppsSection(props: { chats: ChatSummary[]; apps: SpaceApps; folded: boolean; openChatId: string | null; onToggle: () => void; onExplore: () => void; renderChat: (chat: ChatSummary, app: DirectoryApp | undefined) => ReactNode }) {
  const colors = useColores();
  const { apps } = props;
  const all = apps.directory?.apps ?? [];
  const withoutChat = installedWithoutChat(all, props.chats);
  const canInstall = apps.directory?.canInstall ?? false;
  if (props.chats.length === 0 && withoutChat.length === 0 && !canInstall) return null;
  const empty = props.chats.length === 0 && withoutChat.length === 0;
  return (
    <View testID="seccion-apps" className="border-t border-outline/10 pt-1">
      <View className="min-h-[44px] flex-row items-center pl-4 pr-2">
        <Pressable testID="plegar-apps" onPress={props.onToggle} className="min-h-[44px] flex-1 justify-center">
          <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Apps</Text>
        </Pressable>
        <Pressable testID="explorar-apps" onPress={props.onExplore} accessibilityLabel="Explorar apps" hitSlop={8} className="h-9 w-9 items-center justify-center">
          <LayoutGrid size={17} color={colors['on-surface-variant']} />
        </Pressable>
        <Pressable testID="nuevo-apps" onPress={props.onExplore} accessibilityLabel="Agregar apps" hitSlop={8} className="mr-1 h-9 w-9 items-center justify-center">
          <Plus size={18} color={colors['on-surface-variant']} />
        </Pressable>
        <Pressable onPress={props.onToggle} accessibilityLabel={props.folded ? 'Mostrar las apps' : 'Ocultar las apps'} className="h-9 w-7 items-center justify-center">
          {props.folded ? <ChevronRight size={18} color={colors['on-surface-variant']} /> : <ChevronDown size={18} color={colors['on-surface-variant']} />}
        </Pressable>
      </View>
      {props.folded ? null : (
        <>
          {props.chats.map((chat) => props.renderChat(chat, all.find((app) => app.appId === chat.appId)))}
          {withoutChat.map((app) => (
            <InstalledAppRow key={app.appId} app={app} open={Boolean(props.openChatId) && apps.openedChats[app.appId] === props.openChatId} onOpen={() => apps.message(app)} />
          ))}
          {empty ? (
            <Pressable testID="agregar-apps" onPress={props.onExplore} className="min-h-[44px] flex-row items-center gap-3 px-4">
              <Plus size={18} color={colors['on-surface-variant']} />
              <Text className="text-[15px] text-on-surface-variant">Agregar apps</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

/** An installed app nobody here talked to yet: its description instead of a last message; a tap opens its 1:1. */
function InstalledAppRow(props: { app: DirectoryApp; open: boolean; onOpen: () => void }) {
  const colors = useColores();
  const { app } = props;
  return (
    <Pressable testID={`app-fila-${app.appId}`} onPress={props.onOpen} android_ripple={{ color: colors.outline }} className={`min-h-[68px] flex-row items-center gap-3 px-4 py-2 ${props.open ? 'bg-surface' : ''}`}>
      <AppLogo avatarUrl={app.avatarUrl} size={ROW_LOGO_SIZE} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="shrink text-base font-semibold text-on-surface">{app.name}</Text>
          <AppBadge />
        </View>
        {app.description ? <Text numberOfLines={1} className="text-[14px] text-on-surface-variant">{app.description}</Text> : null}
      </View>
    </Pressable>
  );
}
