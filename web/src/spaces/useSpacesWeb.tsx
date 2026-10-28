import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { aplicarMensajeALista, marcarLeido, newlyAddedSpaces, railSpaces, withLiveUnread, type ActivityType, type ClientChannel, type ClientWorkspace, type ClientWorkspaceMember, type DirectoryApp } from '@lilachat/shared';
import { api } from '../api';
import type { ChatMessage, ChatSummary } from '../chat/types';
import { forgetMySpaces, setCurrentSpaceId, useCurrentSpaceId, useMySpaces } from './currentSpace';
import { chatOfChannel, createSpaceChat, spaceActivity, spaceChats } from './spacesApi';
import { markSpacesSeen, readSeenSpaces } from './seenSpaces';
import { fetchSpaceChats, forgetAllSpaces, forgetSpace, isSpaceChat, membersChanged, prefetchSpace, rememberMyRead, setSpaceCacheDisk, spaceChatsCache, useCached } from './spaceCache';
import type { BaseLocal } from '../local/baseLocal';
import { memberName } from './memberWeb';
import { openedChat } from './openedChat';
import { SpacesLayer, type SpaceDialog } from './SpacesLayer';
import type { WorkspaceLink } from './SpaceChatList';
import { peekPendingJoin, takePendingJoin } from './pendingJoin';
import { peekPendingAppReturn, takePendingAppReturn } from './apps/pendingAppReturn';
import { useSpaceApps } from './apps/useSpaceApps';
import { AppDirectory } from './apps/AppDirectory';

/** What a socket event of a space chat says (22/10). */
export type SpaceChatEvent = { type: 'message'; chatId: string; message: ChatMessage } | { type: 'receipt'; chatId: string; userId?: string; readSeq?: number } | { type: 'changed'; chatId: string };
const NO_ACTIVITY = { mentions: 0, threads: 0 };

/** Several messages in a row reload the space's list once. */
const RELOAD_DELAY_MS = 600;
/** The rail's unread counts ask again a little later: one burst, one request. */
const RAIL_RELOAD_DELAY_MS = 2000;

/** One reload for a burst of calls. */
function useDebounced(run: () => void, delayMs: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runRef.current(), delayMs);
  }, [delayMs]);
}

/**
 * The company spaces on the web (E1/E2): which one is open (remembered in
 * this browser), its chats, and its dialogs (`SpacesLayer`): switcher, join,
 * create, invite, channels, directory and profiles, members and requests,
 * settings, a 1:1 or a group inside, «te agregaron» and «ya no tienes acceso».
 * Socket events of chats outside the personal list reload the space's list
 * and the rail's counts.
 */
export function useSpacesWeb(params: { jwt: string; myUserId: string; /** The session's local base: the spaces' screens keep what they saw there (22/10). */ base?: BaseLocal | null; me: { name?: string | null; phone: string }; personalUnread: number; online: ReadonlySet<string>; selectedChatId: string | null; onOpenChat: (chatId: string) => void; onOpenMessage: (chatId: string, seq: number) => void; onPersonalChat: (chatId: string) => void }) {
  const { jwt, myUserId, onOpenChat, onPersonalChat } = params;
  const currentId = useCurrentSpaceId();
  const { spaces, reload } = useMySpaces(jwt, myUserId);
  const [dialog, setDialog] = useState<SpaceDialog>(null);
  /** A join link opened on the web (pending 47): «Unirme» opens with its code, once. */
  // Read pure, removed in the effect: StrictMode runs an initializer twice and a «take» there would lose it.
  const [joinCode] = useState(peekPendingJoin);
  useEffect(() => {
    if (!joinCode) return;
    takePendingJoin();
    setDialog('join');
  }, [joinCode]);
  const [inviting, setInviting] = useState<ClientWorkspace | null>(null);
  const [profile, setProfile] = useState<ClientWorkspaceMember | null>(null);
  const [removed, setRemoved] = useState<ClientWorkspace | null>(null);
  const [seen, setSeen] = useState<string[] | null>(readSeenSpaces);
  /** A chat just joined or created, until the list brings it. */
  const [justOpened, setJustOpened] = useState<ChatSummary | null>(null);
  const [activityTab, setActivityTab] = useState<ActivityType | null>(null);
  const current = spaces?.find((space) => space.id === currentId && space.status === 'active') ?? null;
  const spaceId = current?.id ?? null;

  // A space I left, or where access was removed: back to personal, saying why when it was removed.
  useEffect(() => {
    if (!spaces || !currentId || current) return;
    const lost = spaces.find((space) => space.id === currentId && space.status === 'deactivated');
    if (lost) setRemoved(lost);
    setCurrentSpaceId(null);
  }, [spaces, currentId, current]);
  // The spaces' screens keep what they saw in this person's base; another person starts empty (22/10).
  useEffect(() => {
    setSpaceCacheDisk(params.base ?? null);
    return () => {
      setSpaceCacheDisk(null);
      forgetAllSpaces();
      forgetMySpaces();
    };
  }, [params.base]);
  // Entering a space: its directory, mentions and channels are on their way before anyone clicks.
  useEffect(() => {
    if (spaceId) prefetchSpace(jwt, spaceId);
  }, [jwt, spaceId]);
  // A space I am no longer active in leaves nothing behind: not its directory, not its channels.
  const activeIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!spaces) return;
    const now = new Set(spaces.filter((space) => space.status === 'active').map((space) => space.id));
    for (const id of activeIds.current) if (!now.has(id)) forgetSpace(id);
    activeIds.current = now;
  }, [spaces]);
  // The first list in this browser seeds what was already seen: only spaces added from now on are greeted.
  useEffect(() => {
    if (spaces && seen === null) setSeen(markSpacesSeen(spaces.map((space) => space.id)));
  }, [spaces, seen]);
  const welcome = spaces && seen ? (newlyAddedSpaces(spaces, seen)[0] ?? null) : null;

  // The space's list (and its chips) paints at once from what was seen and refreshes behind (22/10).
  // `jwt` is '' until the session renews on a reload: asking then is a 401 that nothing retries (25/10).
  const page = useCached(spaceChatsCache, spaceId ? `${spaceId}:chats` : null, fetchSpaceChats(jwt, spaceId ?? ''), Boolean(jwt));
  const chats = page.value?.chats ?? null;
  const activity = page.value?.activity ?? NO_ACTIVITY;
  const failed = !page.value && Boolean(page.error);
  const loadChats = page.refresh;

  const reloadChatsSoon = useDebounced(() => loadChats(), RELOAD_DELAY_MS);
  const reloadRailSoon = useDebounced(() => void reload(), RAIL_RELOAD_DELAY_MS);
  /**
   * A socket event of a chat outside the personal list (22/10: applied in place,
   * no longer a reload of the list, the chips and the rail per event). A message
   * in this space's list changes its row; one of another space moves the rail's
   * count; an unknown chat or a changed one is asked for.
   */
  const onChatEvent = useCallback((event: SpaceChatEvent) => {
    if (event.type === 'receipt' && event.userId === myUserId) rememberMyRead(event.chatId, event.readSeq);
    const key = spaceId ? `${spaceId}:chats` : null;
    const inList = Boolean(key && spaceChatsCache.get(key).value?.chats.some((chat) => chat.id === event.chatId));
    if (!inList) {
      if (spaceId && !isSpaceChat(event.chatId)) reloadChatsSoon();
      reloadRailSoon();
      return;
    }
    if (event.type === 'changed') return reloadChatsSoon();
    spaceChatsCache.patch(key!, (current) => {
      const changed = event.type === 'message' ? aplicarMensajeALista(current.chats, event.message, myUserId, params.selectedChatId) : event.userId === myUserId ? marcarLeido(current.chats, event.chatId) : current.chats;
      return changed && changed !== current.chats ? { ...current, chats: changed } : current;
    });
    // A mention or a thread may have arrived: the chips are read with the next quiet refresh.
    if (event.type === 'message' && (event.message.hiloDe !== undefined || event.message.body?.includes('@'))) reloadChatsSoon();
  }, [spaceId, myUserId, params.selectedChatId, reloadChatsSoon, reloadRailSoon]);
  // Opening a chat of the space reads it: its count goes away on the next load.
  const selectedInSpace = Boolean(params.selectedChatId && chats?.some((chat) => chat.id === params.selectedChatId));
  useEffect(() => {
    if (selectedInSpace && spaceId && params.selectedChatId) spaceChatsCache.patch(`${spaceId}:chats`, (current) => ({ ...current, chats: marcarLeido(current.chats, params.selectedChatId!) }));
  }, [params.selectedChatId, selectedInSpace, spaceId]);

  const enter = useCallback(async (next: string | null) => {
    setDialog(null);
    // A space just created or joined is not in the old list (the fallback would send it back to personal); a known one switches at once.
    if (next && !spaces?.some((space) => space.id === next)) await reload();
    setCurrentSpaceId(next);
  }, [reload, spaces]);
  const open = useCallback((chat: ChatSummary) => {
    setDialog(null);
    setProfile(null);
    setJustOpened(chat);
    onOpenChat(chat.id);
    loadChats();
  }, [onOpenChat, loadChats]);
  const openChannel = useCallback((channel: ClientChannel) => spaceId && open(chatOfChannel(channel, spaceId)), [spaceId, open]);
  const writeTo = useCallback(async (member: ClientWorkspaceMember) => {
    if (!spaceId || !member.userId) return;
    const response = await createSpaceChat(jwt, spaceId, { kind: 'direct', memberIds: [member.userId] });
    if (response.ok) open(openedChat({ id: response.data.chatId, kind: 'direct', name: memberName(member), phone: member.phone, memberIds: [myUserId, member.userId] }, spaceId));
  }, [spaceId, jwt, myUserId, open]);
  const openAppChat = useCallback((app: DirectoryApp, chat: { chatId: string; botUserId: string }) => spaceId && open({ ...openedChat({ id: chat.chatId, kind: 'direct', name: app.name, memberIds: [myUserId, chat.botUserId] }, spaceId), appId: app.appId }), [spaceId, myUserId, open]);
  const apps = useSpaceApps({ jwt, spaceId, onChat: openAppChat });
  // Back from agentes after installing (José, 23/10): that space, then the app's detail once its directory is read.
  const [appReturn, setAppReturn] = useState(peekPendingAppReturn);
  useEffect(() => {
    if (!appReturn || !spaces) return;
    if (!spaces.some((space) => space.id === appReturn.spaceId && space.status === 'active')) {
      takePendingAppReturn();
      setAppReturn(null);
    } else if (currentId !== appReturn.spaceId) setCurrentSpaceId(appReturn.spaceId);
  }, [appReturn, spaces, currentId]);
  const { directory, openDirectory, message } = apps;
  useEffect(() => {
    if (!appReturn || spaceId !== appReturn.spaceId || !directory) return;
    takePendingAppReturn();
    setAppReturn(null);
    const app = directory.apps.find((one) => one.clientId === appReturn.clientId);
    // Pending 49: an installed app's 1:1; otherwise its detail.
    if (appReturn.chat && app?.installation) message(app);
    else openDirectory(app?.appId);
  }, [appReturn, spaceId, directory, openDirectory, message]);
  const talkTo = useCallback(async (admin: { userId: string }) => {
    setRemoved(null);
    const response = await api<{ chatId: string }>('/chats', { jwt, body: { kind: 'direct', memberIds: [admin.userId] } });
    if (response.ok) onPersonalChat(response.data.chatId);
  }, [jwt, onPersonalChat]);
  const chatById = useCallback((chatId: string | null) => (chatId ? (chats?.find((chat) => chat.id === chatId) ?? (justOpened?.id === chatId ? justOpened : null)) : null), [chats, justOpened]);

  const layer: ReactNode = (
    <SpacesLayer
      jwt={jwt}
      myUserId={myUserId}
      me={params.me}
      personalUnread={params.personalUnread}
      online={params.online}
      spaces={spaces}
      current={current}
      dialog={dialog}
      joinCode={joinCode}
      invitee={inviting ?? (dialog === 'invite' ? current : null)}
      profile={profile}
      welcome={welcome}
      removed={removed}
      activityTab={activityTab}
      spaceChats={chats ?? []}
      on={{
        dialog: setDialog,
        enter: (next) => void enter(next),
        reload: () => void reload(),
        created: (space) => {
          void enter(space.id);
          // Just created: inviting the team is the next thing to do.
          setInviting(space);
        },
        closeInvite: () => {
          setInviting(null);
          setDialog(null);
        },
        channel: openChannel,
        profile: setProfile,
        writeTo: (member) => void writeTo(member),
        groupCreated: (chat) => spaceId && open(openedChat({ ...chat, kind: 'group' }, spaceId)),
        welcomeSeen: (then) => {
          if (!welcome) return;
          setSeen(markSpacesSeen([welcome.id]));
          if (then) void enter(welcome.id).then(() => then === 'directory' && setDialog('directory'));
        },
        removedSeen: () => setRemoved(null),
        talkTo: (admin) => void talkTo(admin),
        activity: (tab) => {
          setActivityTab(tab);
          // Closing it: what was read there changes the chips' counts.
          if (!tab) loadChats();
        },
        activityItem: (item) => {
          setActivityTab(null);
          params.onOpenMessage(item.chatId, item.seq);
        },
      }}
    />
  );

  // The rail's badge for this space follows its list: reading a chat clears it at once (pending 108).
  const spacesShown = useMemo(() => withLiveUnread(spaces, current?.id ?? null, chats), [spaces, current?.id, chats]);

  return {
    current,
    spaces: spacesShown,
    hasRail: railSpaces(spaces).length > 0,
    chats,
    failed,
    reloadChats: loadChats,
    reloadSpaces: () => void reload(),
    chatById,
    openChat: open,
    onChatEvent,
    enter: (next: string | null) => void enter(next),
    openSwitcher: () => setDialog('switcher'),
    openChannels: () => setDialog('channels'),
    openInvite: () => setDialog('invite'),
    openWorkspace: (link: WorkspaceLink) => setDialog(link),
    openNewDirect: () => setDialog('newDirect'),
    openNewGroup: () => setDialog('newGroup'),
    activity,
    openActivity: setActivityTab,
    apps,
    layer: (
      <>
        {layer}
        {current && apps.open ? <AppDirectory space={current} apps={apps} /> : null}
      </>
    ),
  };
}
