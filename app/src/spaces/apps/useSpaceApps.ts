import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import type { DirectoryApp, SpaceAppDirectory } from '@lilachat/shared';
import { getSocket } from '../../chat/socketClient';
import { useAlVolver } from '../../ui/useAlVolver';
import { appDirectoryCache, appDirectoryKey, fetchAppDirectory, useCached } from '../spaceCache';
import { openAppChat, uninstallApp } from '../spacesApi';

export type SpaceApps = {
  directory: SpaceAppDirectory | null;
  failed: boolean;
  refresh: () => void;
  /** Asks again now, past the cache, and gives what came (back from installing: the copy on the phone is from before). */
  reload: () => Promise<SpaceAppDirectory | null>;
  message: (app: DirectoryApp) => void;
  install: (app: DirectoryApp) => void;
  uninstall: (app: DirectoryApp) => void;
  /** The 1:1 opened with each app in this visit: it is not in the list until its first message. */
  openedChats: Record<string, string>;
  /** The app being uninstalled: the server takes a moment and the detail says so. */
  uninstallingId: string | null;
};

/**
 * The apps of a space, like Slack's (José, 23/10): what was seen paints at
 * once and is asked again when the space opens and when the phone comes back
 * to the app — installing happens in agentes, in the browser —, never polled.
 * Opening one gives its 1:1.
 */
export function useSpaceApps(params: { jwt: string; spaceId: string | null; active: boolean; onChat: (app: DirectoryApp, chat: { chatId: string; botUserId: string }) => void }): SpaceApps {
  const { jwt, spaceId, onChat } = params;
  const entry = useCached(appDirectoryCache, spaceId ? appDirectoryKey(spaceId) : null, spaceId ? fetchAppDirectory(jwt, spaceId) : () => Promise.reject(new Error('sin espacio')));
  const [opened, setOpened] = useState<{ spaceId: string | null; chats: Record<string, string> }>({ spaceId: null, chats: {} });
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const { refresh } = entry;
  useAlVolver(params.active, refresh);
  // Installed, uninstalled or a new manifest (23/10): the directory and the head of a 1:1 read it again.
  useEffect(() => {
    const socket = getSocket();
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId === spaceId) refresh();
    };
    socket?.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket?.off('workspace.apps.changed', onAppsChanged);
    };
  }, [spaceId, refresh]);
  const reload = useCallback(async () => {
    if (!spaceId) return null;
    await appDirectoryCache.revalidate(appDirectoryKey(spaceId), fetchAppDirectory(jwt, spaceId), { force: true });
    return appDirectoryCache.get(appDirectoryKey(spaceId)).value ?? null;
  }, [jwt, spaceId]);

  const message = useCallback(
    (app: DirectoryApp) => {
      if (!spaceId) return;
      void openAppChat(jwt, spaceId, app.appId).then((result) => {
        if (!result.ok) return;
        setOpened((known) => ({ spaceId, chats: { ...(known.spaceId === spaceId ? known.chats : {}), [app.appId]: result.data.chatId } }));
        onChat(app, result.data);
      });
    },
    [jwt, spaceId, onChat]
  );
  const install = useCallback((app: DirectoryApp) => {
    if (app.installUrl) void Linking.openURL(app.installUrl);
  }, []);
  const uninstall = useCallback(
    (app: DirectoryApp) => {
      if (!spaceId || !app.installation) return;
      setUninstallingId(app.appId);
      void uninstallApp(jwt, spaceId, app.installation.installationId)
        .then(() => appDirectoryCache.revalidate(appDirectoryKey(spaceId), fetchAppDirectory(jwt, spaceId), { force: true }))
        .finally(() => setUninstallingId(null));
    },
    [jwt, spaceId]
  );
  return { directory: entry.value ?? null, failed: !entry.value && Boolean(entry.error), refresh, reload, message, install, uninstall, openedChats: opened.spaceId === spaceId ? opened.chats : {}, uninstallingId };
}
