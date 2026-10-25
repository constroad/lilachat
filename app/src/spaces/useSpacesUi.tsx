import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SpaceQuickActions } from './apps/SpaceQuickActions';
import { Linking, Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { appReturnFromLink, joinCodeFromLink, newlyAddedSpaces, spaceSubtitle, unreadElsewhere, type ActivityItem, type ActivityType, type ClientChannel, type ClientWorkspace, type ClientWorkspaceMember, type DirectoryApp } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import { createChat } from '../contacts/contactsApi';
import { getSocket } from '../chat/socketClient';
import { useAlVolver } from '../ui/useAlVolver';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { setCurrentSpaceId, useCurrentSpaceId, useMySpaces } from './currentSpace';
import { forgetSpace, membersChanged, prefetchSpace } from './spaceCache';
import { SpaceLogo, SpaceSwitcherSheet } from './SpaceSwitcherSheet';
import { JoinSpaceScreen } from './JoinSpaceScreen';
import { CreateSpaceScreen } from './CreateSpaceScreen';
import { InviteToSpaceScreen } from './InviteToSpaceScreen';
import { ChannelsScreen } from './ChannelsScreen';
import { DirectoryScreen } from './DirectoryScreen';
import { MemberProfileScreen } from './MemberProfileScreen';
import { MembersScreen } from './MembersScreen';
import { SpaceSettingsScreen } from './SpaceSettingsScreen';
import { NewSpaceGroupScreen } from './NewSpaceGroupScreen';
import { AddedToSpaceScreen } from './AddedToSpaceScreen';
import { AccessRemovedScreen } from './AccessRemovedScreen';
import { markSpacesSeen, useSeenSpaces } from './seenSpaces';
import { memberName } from './memberUi';
import { createSpaceChat, findSpaceChat } from './spacesApi';
import { ActivityScreen } from '../activity/ActivityScreen';
import type { WorkspaceLink } from './SpaceChatsScreen';
import { AppDirectoryScreen } from './apps/AppDirectoryScreen';
import { useSpaceApps } from './apps/useSpaceApps';

type Sheet = 'switcher' | 'join' | 'create' | 'invite' | 'channels' | 'directory' | 'members' | 'requests' | 'settings' | 'newDirect' | 'newGroup' | 'apps' | null;

/** A chat of the space as the conversation opens it until the list brings it. */
const spaceChat = (chat: Pick<ChatSummary, 'id' | 'kind' | 'name' | 'phone' | 'memberIds' | 'channel'>, spaceId: string): ChatSummary => ({
  lastSeq: 0,
  unread: 0,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  lastMessage: null,
  workspaceId: spaceId,
  ...chat,
});

/** A channel just joined or created, as the conversation opens it (the list fills the rest when it reloads). */
export const chatOfChannel = (channel: ClientChannel, spaceId: string): ChatSummary => spaceChat({ id: channel.id, kind: 'group', name: channel.name, memberIds: [], channel: { visibility: channel.visibility } }, spaceId);

/** Several messages in a row read the spaces' counters once. */
const ELSEWHERE_RELOAD_MS = 1500;

/**
 * The company spaces in the Chats tab (E1/E2): the header's title opens «Cambiar
 * de espacio» (design `e1-06`), and from there joining (e1-02/03), creating
 * (e1-04) and inviting (e1-05); the space's channels (e2-15/16), its directory
 * and profiles (e1-08/09), members, roles and requests (e1-10/11), settings
 * (e1-12), a 1:1 or a group inside it, «te agregaron» (e1-13) once per space
 * someone else added me to, and «ya no tienes acceso» (e1-14). The space open
 * is remembered; one left falls back to personal.
 */
export function useSpacesUi(params: { jwt: string; myUserId: string; me: { name: string; phone: string }; personalUnread: number; onOpenChat: (chat: ChatSummary, seq?: number, openThread?: number) => void }) {
  const { jwt, myUserId, onOpenChat } = params;
  const colors = useColores();
  const currentId = useCurrentSpaceId();
  const { spaces, reload } = useMySpaces(jwt, myUserId);
  const seen = useSeenSpaces();
  const [sheet, setSheet] = useState<Sheet>(null);
  /** A space's join link (pending 47): Android opens the app on it, and «Unirme» opens with its code. */
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [appReturn, setAppReturn] = useState<{ spaceId: string; clientId: string; chat?: true } | null>(null);
  const [appsInitialId, setAppsInitialId] = useState<string | null>(null);
  /** While the return opens its app, the «te agregaron» screen waits: two windows at once and the second never showed (emulator, 23/10). */
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    const openLink = (url: string | null) => {
      // Back from agentes after installing an app (José, 23/10): that space, on the app's detail.
      const back = appReturnFromLink(url);
      if (back) return void setAppReturn(back);
      const code = joinCodeFromLink(url);
      if (!code) return;
      setJoinCode(code);
      setSheet('join');
    };
    void Linking.getInitialURL().then(openLink);
    const subscription = Linking.addEventListener('url', (event) => openLink(event.url));
    return () => subscription.remove();
  }, []);
  const [inviting, setInviting] = useState<ClientWorkspace | null>(null);
  const [profile, setProfile] = useState<ClientWorkspaceMember | null>(null);
  const [removed, setRemoved] = useState<ClientWorkspace | null>(null);
  const [listChats, setListChats] = useState<ChatSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [activityTab, setActivityTab] = useState<ActivityType | null>(null);
  const current = spaces?.find((space) => space.id === currentId && space.status === 'active') ?? null;

  // A space I left, or where access was removed: back to personal, saying why when it was removed.
  useEffect(() => {
    if (!spaces || !currentId || current) return;
    const lost = spaces.find((space) => space.id === currentId && space.status === 'deactivated');
    if (lost) setRemoved(lost);
    setCurrentSpaceId(null);
  }, [spaces, currentId, current]);
  // Entering a space: its directory, mentions and channels are on their way before anyone taps (22/10).
  useEffect(() => {
    if (current?.id) prefetchSpace(jwt, current.id);
  }, [jwt, current?.id]);
  // A space I am no longer active in leaves nothing behind: not its directory, not its channels.
  const activeIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!spaces) return;
    const now = new Set(spaces.filter((space) => space.status === 'active').map((space) => space.id));
    for (const id of activeIds.current) if (!now.has(id)) forgetSpace(id);
    activeIds.current = now;
  }, [spaces]);
  // A request, approved, added or deactivated somewhere else: read them again, also on coming back to the app.
  useEffect(() => {
    const socket = getSocket();
    const onChanged = () => void reload();
    // A space's people changed (22/10): its directories refresh where they are open.
    const onMembers = (frame: { workspaceId?: string }) => frame.workspaceId && membersChanged(frame.workspaceId);
    socket?.on('workspaces.changed', onChanged);
    socket?.on('workspace.members.changed', onMembers);
    return () => {
      socket?.off('workspaces.changed', onChanged);
      socket?.off('workspace.members.changed', onMembers);
    };
  }, [reload]);
  useAlVolver(true, () => void reload());
  // The first list after installing seeds what was already seen: only spaces added from now on are greeted.
  useEffect(() => {
    if (spaces && seen === null) markSpacesSeen(spaces.map((space) => space.id));
  }, [spaces, seen]);
  const welcome = spaces && seen ? (newlyAddedSpaces(spaces, seen)[0] ?? null) : null;

  const enter = useCallback(async (spaceId: string | null) => {
    setSheet(null);
    // A space just created or joined is not in the old list (the fallback above would send it back to personal); a known one switches at once.
    if (spaceId && !spaces?.some((space) => space.id === spaceId)) await reload();
    setCurrentSpaceId(spaceId);
  }, [reload, spaces]);
  const openChannel = useCallback((channel: ClientChannel) => {
    setSheet(null);
    if (current) onOpenChat(chatOfChannel(channel, current.id));
  }, [current, onOpenChat]);
  const writeTo = useCallback(async (member: ClientWorkspaceMember) => {
    if (!current || !member.userId) return;
    const response = await createSpaceChat(jwt, current.id, { kind: 'direct', memberIds: [member.userId] });
    if (!response.ok) return;
    setSheet(null);
    setProfile(null);
    setReloadKey((key) => key + 1);
    onOpenChat(spaceChat({ id: response.data.chatId, kind: 'direct', name: memberName(member), phone: member.phone, memberIds: [myUserId, member.userId] }, current.id));
  }, [current, jwt, myUserId, onOpenChat]);
  const talkToAdmin = useCallback(async (admin: { userId: string; name?: string; phone: string }) => {
    const response = await createChat(jwt, { kind: 'direct', memberIds: [admin.userId] });
    setRemoved(null);
    if (response.ok) onOpenChat({ id: response.data.chatId, kind: 'direct', name: admin.name, phone: admin.phone, memberIds: [myUserId, admin.userId], lastSeq: 0, unread: 0, othersReadSeq: 0, othersDeliveredSeq: 0, lastMessage: null });
  }, [jwt, myUserId, onOpenChat]);
  const openWorkspace = useCallback((link: WorkspaceLink) => setSheet(link), []);
  const openActivityItem = useCallback(async (item: ActivityItem, tab: ActivityType) => {
    if (!current) return;
    const chat = listChats.find((one) => one.id === item.chatId) ?? (await findSpaceChat(jwt, current.id, item.chatId));
    if (!chat) return;
    setActivityTab(null);
    // A row of «Hilos» is the thread itself (its root is the item): it opens the thread over the chat. A mention or a reaction on a message that has replies still lands on the message.
    onOpenChat(chat, item.seq, tab === 'threads' && item.thread ? item.seq : undefined);
  }, [current, listChats, jwt, onOpenChat]);
  // The 1:1 with an app (design e-26): opened from «Apps» or the directory; the list brings it with its first message.
  const openAppChat = useCallback((app: DirectoryApp, chat: { chatId: string; botUserId: string }) => {
    if (!current) return;
    setSheet(null);
    onOpenChat({ ...spaceChat({ id: chat.chatId, kind: 'direct', name: app.name, memberIds: [myUserId, chat.botUserId] }, current.id), appId: app.appId, avatarUrl: app.avatarUrl });
  }, [current, myUserId, onOpenChat]);
  const apps = useSpaceApps({ jwt, spaceId: current?.id ?? null, active: true, onChat: openAppChat });
  useEffect(() => {
    if (!appReturn || !spaces) return;
    if (!spaces.some((space) => space.id === appReturn.spaceId && space.status === 'active')) return void setAppReturn(null);
    if (currentId !== appReturn.spaceId) setCurrentSpaceId(appReturn.spaceId);
  }, [appReturn, spaces, currentId]);
  const { reload: reloadApps, message: messageApp } = apps;
  useEffect(() => {
    if (!appReturn || current?.id !== appReturn.spaceId) return;
    const wanted = appReturn;
    setAppReturn(null);
    setReturning(true);
    void reloadApps()
      .then((directory) => {
        const app = directory?.apps.find((one) => one.clientId === wanted.clientId);
        // Pending 49: «/chat» opens an installed app's 1:1; otherwise its detail.
        if (wanted.chat && app?.installation) return messageApp(app);
        setAppsInitialId(app?.appId ?? null);
        setSheet('apps');
      })
      .finally(() => setReturning(false));
  }, [appReturn, current?.id, reloadApps, messageApp]);
  const openNewDirect = useCallback(() => setSheet('newDirect'), []);
  const openNewGroup = useCallback(() => setSheet('newGroup'), []);

  // A message in personal or in another space is not missed (José, 22/10): the title carries how many chats wait elsewhere.
  const elsewhere = unreadElsewhere({ spaces, currentId: current?.id ?? null, personalUnread: params.personalUnread });
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadSoon = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void reload(), ELSEWHERE_RELOAD_MS);
  }, [reload]);
  useEffect(() => () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
  }, []);
  const title: ReactNode = (
    <>
    <Pressable testID="titulo-espacio" accessibilityLabel="Cambiar de espacio" onPress={() => setSheet('switcher')} className="min-h-[44px] flex-1 flex-row items-center gap-2.5">
      {current ? <SpaceLogo space={current} size={36} /> : <Logo tamano={32} />}
      <View className="min-w-0 flex-shrink">
        <View className="flex-row items-center gap-1">
          <Text numberOfLines={1} className={`text-[22px] font-bold ${current ? 'text-on-surface' : 'text-primary'}`}>{current ? current.name : 'Lilachat'}</Text>
          <ChevronDown size={18} color={colors['on-surface-variant']} />
          {elsewhere > 0 ? (
            <View testID="badge-otros-espacios" accessibilityLabel={`${elsewhere} ${elsewhere === 1 ? 'chat' : 'chats'} con algo nuevo en otro espacio`} className="ml-0.5 h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5">
              <Text className="text-[11px] font-bold text-on-primary">{elsewhere > 99 ? '99+' : elsewhere}</Text>
            </View>
          ) : null}
        </View>
        {current ? <Text className="-mt-0.5 text-[12px] text-on-surface-variant">{spaceSubtitle(current, { membersFirst: true })}</Text> : null}
      </View>
    </Pressable>
    {/* The space's ⚡ (design e-30): the apps' actions without entering a channel. */}
    {current ? <SpaceQuickActions jwt={jwt} spaceId={current.id} spaceName={current.name} myName={params.me?.name ?? undefined} /> : null}
    </>
  );

  const commonChannels = profile?.userId ? listChats.filter((chat) => chat.channel && chat.memberIds.includes(profile.userId!)).map((chat) => chat.name ?? '') : [];
  const layer: ReactNode = (
    <>
      <SpaceSwitcherSheet visible={sheet === 'switcher'} spaces={spaces} currentId={current?.id ?? null} me={params.me} personalUnread={params.personalUnread} onPick={(spaceId) => void enter(spaceId)} onJoin={() => setSheet('join')} onCreate={() => setSheet('create')} onClose={() => setSheet(null)} onOpen={() => void reload()} />
      <JoinSpaceScreen visible={sheet === 'join'} jwt={jwt} initialCode={joinCode} onJoined={(spaceId) => void enter(spaceId)} onClose={() => { setSheet(null); setJoinCode(null); void reload(); }} />
      <CreateSpaceScreen
        visible={sheet === 'create'}
        jwt={jwt}
        onJoinInstead={() => setSheet('join')}
        onCreated={(space) => {
          void enter(space.id);
          // Just created: inviting the team is the next thing to do.
          setInviting(space);
        }}
        onClose={() => setSheet(null)}
      />
      {inviting || sheet === 'invite' ? <InviteToSpaceScreen space={inviting ?? current} jwt={jwt} inviterName={params.me.name || undefined} onClose={() => { setInviting(null); setSheet(null); }} /> : null}
      {sheet === 'channels' ? <ChannelsScreen space={current} jwt={jwt} onOpenChannel={openChannel} onClose={() => setSheet(null)} /> : null}
      {current && (sheet === 'directory' || sheet === 'newDirect') ? (
        <DirectoryScreen space={current} jwt={jwt} myUserId={myUserId} picking={sheet === 'newDirect'} onOpenMember={setProfile} onMessage={(member) => void writeTo(member)} onInvite={current.joinCode ? () => setSheet('invite') : undefined} onClose={() => setSheet(null)} />
      ) : null}
      {current && profile ? <MemberProfileScreen space={current} member={profile} isMe={profile.userId === myUserId} commonChannels={commonChannels} onMessage={() => void writeTo(profile)} onClose={() => setProfile(null)} /> : null}
      {current && (sheet === 'members' || sheet === 'requests') ? (
        <MembersScreen space={current} jwt={jwt} myUserId={myUserId} initialTab={sheet === 'requests' ? 'pending' : 'active'} onInvite={() => setSheet('invite')} onChanged={() => void reload()} onClose={() => setSheet(null)} />
      ) : null}
      {current && sheet === 'apps' ? <AppDirectoryScreen space={current} apps={apps} jwt={jwt} initialAppId={appsInitialId} onClose={() => { setSheet(null); setAppsInitialId(null); }} /> : null}
      {current && sheet === 'settings' ? <SpaceSettingsScreen space={current} jwt={jwt} onSaved={() => void reload()} onClose={() => setSheet(null)} /> : null}
      {current && sheet === 'newGroup' ? (
        <NewSpaceGroupScreen space={current} jwt={jwt} myUserId={myUserId} onCreated={(chat) => { setSheet(null); setReloadKey((key) => key + 1); onOpenChat(spaceChat({ ...chat, kind: 'group' }, current.id)); }} onClose={() => setSheet(null)} />
      ) : null}
      {welcome && !sheet && !appReturn && !returning ? (
        <AddedToSpaceScreen
          space={welcome}
          jwt={jwt}
          onEnter={() => { markSpacesSeen([welcome.id]); void enter(welcome.id); }}
          onDirectory={() => { markSpacesSeen([welcome.id]); void enter(welcome.id).then(() => setSheet('directory')); }}
          onLater={() => markSpacesSeen([welcome.id])}
        />
      ) : null}
      {current ? <ActivityScreen visible={activityTab !== null} space={current} jwt={jwt} myUserId={myUserId} initialTab={activityTab ?? 'mentions'} onOpen={(item, tab) => void openActivityItem(item, tab)} onClose={() => { setActivityTab(null); setReloadKey((key) => key + 1); }} /> : null}
      {removed ? <AccessRemovedScreen space={removed} onPersonal={() => setRemoved(null)} onTalkTo={(admin) => void talkToAdmin(admin)} /> : null}
    </>
  );

  // Directorio and Menciones as tabs of the bar (22/10): mounted once and hidden, like Chats; no window that slides in.
  const directoryTab: ReactNode = current ? <DirectoryScreen embedded space={current} jwt={jwt} myUserId={myUserId} onOpenMember={setProfile} onMessage={(member) => void writeTo(member)} onInvite={current.joinCode ? () => setSheet('invite') : undefined} onClose={() => undefined} /> : null;
  const mentionsTab = (active: boolean): ReactNode => (current ? <ActivityScreen embedded visible={active} space={current} jwt={jwt} myUserId={myUserId} initialTab="mentions" onOpen={(item, tab) => void openActivityItem(item, tab)} onClose={() => undefined} /> : null);
  return {
    current,
    /** Am I in any company space? `null` while it loads (who an update is for, José 24/10). */
    inSpaces: spaces === null ? null : spaces.some((space) => space.status === 'active'),
    title,
    layer,
    directoryTab,
    mentionsTab,
    openChannels: () => setSheet('channels'),
    /** The space's part of the «Ajustes» tab (José, 24/10; design e-34). */
    settingsSection: current ? { space: current, apps: (apps.directory?.apps ?? []).filter((app) => app.installation).map((app) => app.name), open: (link: 'settings' | 'members' | 'channels' | 'apps' | 'invite' | 'switch') => setSheet(link === 'switch' ? 'switcher' : link) } : null,
    openInvite: () => setSheet('invite'),
    /** A message arrived in a chat outside the personal list: the spaces' counters are read again, once per burst. */
    reloadSoon,
    listProps: { reloadKey, onWorkspace: openWorkspace, onNewDirect: openNewDirect, onNewGroup: openNewGroup, onChats: setListChats, onRefresh: reload, onActivity: setActivityTab, apps, onExploreApps: () => setSheet('apps') },
  };
}
