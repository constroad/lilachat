import { useCallback, useEffect, useRef, useState } from 'react';
import type { DirectoryApp, SpaceAppDirectory } from '@lilachat/shared';
import { currentSocket } from '../../useSocket';
import { appDirectory, openAppChat, uninstallApp } from '../spacesApi';

/** Coming back from agentes' tab reads the directory again, but not more often than this. */
const FOCUS_REFRESH_MS = 15_000;

export type SpaceApps = {
  directory: SpaceAppDirectory | null;
  /** The directory layer (design e-24), with the app chosen in its detail. */
  open: { appId: string | null } | null;
  openDirectory: (appId?: string) => void;
  closeDirectory: () => void;
  message: (app: DirectoryApp) => void;
  install: (app: DirectoryApp) => void;
  uninstall: (app: DirectoryApp) => void;
  /** The 1:1 opened with each app in this visit: it is not in the list until its first message. */
  openedChats: Record<string, string>;
  /** The app being uninstalled: the server takes a moment and the detail says so. */
  uninstallingId: string | null;
  /** For what the detail asks on its own («Avisos», R160). */
  jwt: string;
  spaceId: string | null;
};

/**
 * The apps of a space, like Slack's (José, 23/10): asked when the space opens
 * and when the tab comes back, never polled. Installing happens in agentes, in
 * another tab; opening one gives its 1:1.
 */
export function useSpaceApps(params: { jwt: string; spaceId: string | null; onChat: (app: DirectoryApp, chat: { chatId: string; botUserId: string }) => void }): SpaceApps {
  const { jwt, spaceId, onChat } = params;
  const [directory, setDirectory] = useState<SpaceAppDirectory | null>(null);
  const [open, setOpen] = useState<{ appId: string | null } | null>(null);
  const [openedChats, setOpenedChats] = useState<Record<string, string>>({});
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const lastRead = useRef(0);
  const refresh = useCallback(async () => {
    // No token yet on a reload (25/10): this runs again when the session renews.
    if (!spaceId || !jwt) return;
    lastRead.current = Date.now();
    const result = await appDirectory(jwt, spaceId);
    if (result.ok) setDirectory(result.data);
  }, [jwt, spaceId]);

  useEffect(() => {
    setDirectory(null);
    setOpen(null);
    setOpenedChats({});
    void refresh();
  }, [refresh]);
  // Installed, uninstalled or a new manifest (23/10): read again now.
  useEffect(() => {
    const socket = currentSocket();
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId === spaceId) void refresh();
    };
    socket?.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket?.off('workspace.apps.changed', onAppsChanged);
    };
  }, [spaceId, refresh]);
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastRead.current > FOCUS_REFRESH_MS) void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const message = useCallback(
    (app: DirectoryApp) => {
      if (!spaceId) return;
      void openAppChat(jwt, spaceId, app.appId).then((result) => {
        if (!result.ok) return;
        setOpen(null);
        setOpenedChats((known) => ({ ...known, [app.appId]: result.data.chatId }));
        onChat(app, result.data);
      });
    },
    [jwt, spaceId, onChat]
  );
  const install = useCallback((app: DirectoryApp) => {
    if (app.installUrl) window.open(app.installUrl, '_blank', 'noopener');
  }, []);
  const uninstall = useCallback(
    (app: DirectoryApp) => {
      if (!spaceId || !app.installation) return;
      setUninstallingId(app.appId);
      void uninstallApp(jwt, spaceId, app.installation.installationId)
        .then(() => refresh())
        .finally(() => setUninstallingId(null));
    },
    [jwt, spaceId, refresh]
  );
  return { directory, open, openDirectory: (appId) => setOpen({ appId: appId ?? null }), closeDirectory: () => setOpen(null), message, install, uninstall, openedChats, uninstallingId, jwt, spaceId };
}
