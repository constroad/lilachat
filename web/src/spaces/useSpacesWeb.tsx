import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { newlyAddedSpaces, railSpaces, type ActivityType, type ClientChannel, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
import { api } from '../api';
import type { ChatSummary } from '../chat/types';
import { setCurrentSpaceId, useCurrentSpaceId, useMySpaces } from './currentSpace';
import { chatOfChannel, createSpaceChat, spaceActivity, spaceChats } from './spacesApi';
import { markSpacesSeen, readSeenSpaces } from './seenSpaces';
import { memberName } from './memberWeb';
import { SpacesLayer, type SpaceDialog } from './SpacesLayer';
import type { WorkspaceLink } from './SpaceChatList';

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

/** A chat of the space as the conversation opens it until the list brings it. */
const openedChat = (chat: Pick<ChatSummary, 'id' | 'kind' | 'name' | 'phone' | 'memberIds'>, spaceId: string): ChatSummary => ({ lastSeq: 0, unread: 0, othersReadSeq: 0, othersDeliveredSeq: 0, lastMessage: null, workspaceId: spaceId, ...chat });

/**
 * The company spaces on the web (E1/E2): which one is open (remembered in
 * this browser), its chats, and its dialogs (`SpacesLayer`): switcher, join,
 * create, invite, channels, directory and profiles, members and requests,
 * settings, a 1:1 or a group inside, «te agregaron» and «ya no tienes acceso».
 * Socket events of chats outside the personal list reload the space's list
 * and the rail's counts.
 */
export function useSpacesWeb(params: { jwt: string; myUserId: string; me: { name?: string | null; phone: string }; personalUnread: number; online: ReadonlySet<string>; selectedChatId: string | null; onOpenChat: (chatId: string) => void; onOpenMessage: (chatId: string, seq: number) => void; onPersonalChat: (chatId: string) => void }) {
  const { jwt, myUserId, onOpenChat, onPersonalChat } = params;
  const currentId = useCurrentSpaceId();
  const { spaces, reload } = useMySpaces(jwt);
  const [dialog, setDialog] = useState<SpaceDialog>(null);
  const [inviting, setInviting] = useState<ClientWorkspace | null>(null);
  const [profile, setProfile] = useState<ClientWorkspaceMember | null>(null);
  const [removed, setRemoved] = useState<ClientWorkspace | null>(null);
  const [seen, setSeen] = useState<string[] | null>(readSeenSpaces);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** A chat just joined or created, until the list brings it. */
  const [justOpened, setJustOpened] = useState<ChatSummary | null>(null);
  const [activity, setActivity] = useState({ mentions: 0, threads: 0 });
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
  // The first list in this browser seeds what was already seen: only spaces added from now on are greeted.
  useEffect(() => {
    if (spaces && seen === null) setSeen(markSpacesSeen(spaces.map((space) => space.id)));
  }, [spaces, seen]);
  const welcome = spaces && seen ? (newlyAddedSpaces(spaces, seen)[0] ?? null) : null;

  const shownSpace = useRef(spaceId);
  shownSpace.current = spaceId;
  const loadChats = useCallback(async () => {
    if (!spaceId) return;
    const [response, counts] = await Promise.all([spaceChats(jwt, spaceId), spaceActivity(jwt, spaceId, { countsOnly: true })]);
    // Switched spaces while it was on its way: that list is not this space's.
    if (shownSpace.current !== spaceId) return;
    if (counts.ok) setActivity(counts.data.unread);
    if (response.ok) {
      setChats(response.data.chats);
      setFailed(false);
    } else setFailed(true);
  }, [jwt, spaceId]);
  useEffect(() => {
    setChats(null);
    setFailed(false);
    void loadChats();
  }, [loadChats]);

  const reloadChatsSoon = useDebounced(() => void loadChats(), RELOAD_DELAY_MS);
  const reloadRailSoon = useDebounced(() => void reload(), RAIL_RELOAD_DELAY_MS);
  /** A socket event of a chat that is not in the personal list. */
  const onChatEvent = useCallback(() => {
    if (spaceId) reloadChatsSoon();
    reloadRailSoon();
  }, [spaceId, reloadChatsSoon, reloadRailSoon]);
  // Opening a chat of the space reads it: its count goes away on the next load.
  const selectedInSpace = Boolean(params.selectedChatId && chats?.some((chat) => chat.id === params.selectedChatId));
  useEffect(() => {
    if (selectedInSpace) onChatEvent();
  }, [params.selectedChatId, selectedInSpace, onChatEvent]);

  const enter = useCallback(async (next: string | null) => {
    setDialog(null);
    // The list first: a space just created or joined is not in the old one, and the fallback would send it back to personal.
    if (next) await reload();
    setCurrentSpaceId(next);
  }, [reload]);
  const open = useCallback((chat: ChatSummary) => {
    setDialog(null);
    setProfile(null);
    setJustOpened(chat);
    onOpenChat(chat.id);
    void loadChats();
  }, [onOpenChat, loadChats]);
  const openChannel = useCallback((channel: ClientChannel) => spaceId && open(chatOfChannel(channel, spaceId)), [spaceId, open]);
  const writeTo = useCallback(async (member: ClientWorkspaceMember) => {
    if (!spaceId || !member.userId) return;
    const response = await createSpaceChat(jwt, spaceId, { kind: 'direct', memberIds: [member.userId] });
    if (response.ok) open(openedChat({ id: response.data.chatId, kind: 'direct', name: memberName(member), phone: member.phone, memberIds: [myUserId, member.userId] }, spaceId));
  }, [spaceId, jwt, myUserId, open]);
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
          if (!tab) void loadChats();
        },
        activityItem: (item) => {
          setActivityTab(null);
          params.onOpenMessage(item.chatId, item.seq);
        },
      }}
    />
  );

  return {
    current,
    spaces,
    hasRail: railSpaces(spaces).length > 0,
    chats,
    failed,
    reloadChats: () => void loadChats(),
    reloadSpaces: () => void reload(),
    chatById,
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
    layer,
  };
}
