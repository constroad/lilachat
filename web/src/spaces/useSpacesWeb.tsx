import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { railSpaces, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import type { ChatSummary } from '../chat/types';
import { setCurrentSpaceId, useCurrentSpaceId, useMySpaces } from './currentSpace';
import { chatOfChannel, spaceChats } from './spacesApi';
import { SpaceSwitcher } from './SpaceSwitcher';
import { JoinSpaceDialog } from './JoinSpaceDialog';
import { CreateSpaceDialog } from './CreateSpaceDialog';
import { InviteToSpaceDialog } from './InviteToSpaceDialog';
import { ChannelsDialog } from './ChannelsDialog';

/** Several messages in a row reload the space's list once. */
const RELOAD_DELAY_MS = 600;
/** The rail's unread counts ask again a little later: one burst, one request. */
const RAIL_RELOAD_DELAY_MS = 2000;

type Dialog = 'switcher' | 'join' | 'create' | 'invite' | 'channels' | null;

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
 * this browser), its chats, and the switcher, join, create, invite and
 * channels dialogs. A space left or whose access was removed falls back to
 * personal. Socket events of chats outside the personal list reload the
 * space's list and the rail's counts.
 */
export function useSpacesWeb(params: { jwt: string; me: { name?: string | null; phone: string }; personalUnread: number; selectedChatId: string | null; onOpenChat: (chatId: string) => void }) {
  const { jwt, onOpenChat } = params;
  const currentId = useCurrentSpaceId();
  const { spaces, reload } = useMySpaces(jwt);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [inviting, setInviting] = useState<ClientWorkspace | null>(null);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** A channel just joined or created, until the list brings it. */
  const [justOpened, setJustOpened] = useState<ChatSummary | null>(null);
  const current = spaces?.find((space) => space.id === currentId && space.status === 'active') ?? null;
  const spaceId = current?.id ?? null;

  useEffect(() => {
    if (spaces && currentId && !current) setCurrentSpaceId(null);
  }, [spaces, currentId, current]);

  const shownSpace = useRef(spaceId);
  shownSpace.current = spaceId;
  const loadChats = useCallback(async () => {
    if (!spaceId) return;
    const response = await spaceChats(jwt, spaceId);
    // Switched spaces while it was on its way: that list is not this space's.
    if (shownSpace.current !== spaceId) return;
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
  const openChannel = useCallback((channel: ClientChannel) => {
    setDialog(null);
    if (!spaceId) return;
    setJustOpened(chatOfChannel(channel, spaceId));
    onOpenChat(channel.id);
    void loadChats();
  }, [spaceId, onOpenChat, loadChats]);
  const chatById = useCallback((chatId: string | null) => (chatId ? (chats?.find((chat) => chat.id === chatId) ?? (justOpened?.id === chatId ? justOpened : null)) : null), [chats, justOpened]);

  const invitee = inviting ?? (dialog === 'invite' ? current : null);
  const layer: ReactNode = (
    <>
      {dialog === 'switcher' ? (
        <SpaceSwitcher spaces={spaces} currentId={spaceId} me={params.me} personalUnread={params.personalUnread} onPick={(next) => void enter(next)} onJoin={() => setDialog('join')} onCreate={() => setDialog('create')} onClose={() => setDialog(null)} onOpen={() => void reload()} />
      ) : null}
      {dialog === 'join' ? <JoinSpaceDialog jwt={jwt} onJoined={(next) => void enter(next)} onClose={() => { setDialog(null); void reload(); }} /> : null}
      {dialog === 'create' ? (
        <CreateSpaceDialog
          jwt={jwt}
          onJoinInstead={() => setDialog('join')}
          onCreated={(space) => {
            void enter(space.id);
            // Just created: inviting the team is the next thing to do.
            setInviting(space);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {invitee ? <InviteToSpaceDialog space={invitee} jwt={jwt} inviterName={params.me.name ?? undefined} onClose={() => { setInviting(null); setDialog(null); }} /> : null}
      {dialog === 'channels' && current ? <ChannelsDialog space={current} jwt={jwt} onOpenChannel={openChannel} onClose={() => setDialog(null)} /> : null}
    </>
  );

  return {
    current,
    spaces,
    hasRail: railSpaces(spaces).length > 0,
    chats,
    failed,
    reloadChats: () => void loadChats(),
    chatById,
    onChatEvent,
    enter: (next: string | null) => void enter(next),
    openSwitcher: () => setDialog('switcher'),
    openChannels: () => setDialog('channels'),
    openInvite: () => setDialog('invite'),
    layer,
  };
}
