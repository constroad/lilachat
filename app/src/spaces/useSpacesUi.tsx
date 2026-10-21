import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { spaceSubtitle, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { setCurrentSpaceId, useCurrentSpaceId, useMySpaces } from './currentSpace';
import { SpaceLogo, SpaceSwitcherSheet } from './SpaceSwitcherSheet';
import { JoinSpaceScreen } from './JoinSpaceScreen';
import { CreateSpaceScreen } from './CreateSpaceScreen';
import { InviteToSpaceScreen } from './InviteToSpaceScreen';
import { ChannelsScreen } from './ChannelsScreen';

type Sheet = 'switcher' | 'join' | 'create' | 'invite' | 'channels' | null;

/** A channel just joined or created, as the conversation opens it (the list fills the rest when it reloads). */
export const chatOfChannel = (channel: ClientChannel, spaceId: string): ChatSummary => ({
  id: channel.id,
  kind: 'group',
  name: channel.name,
  memberIds: [],
  lastSeq: 0,
  unread: 0,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  lastMessage: null,
  workspaceId: spaceId,
  channel: { visibility: channel.visibility },
});

/**
 * The company spaces in the Chats tab (E1/E2): the header's title opens «Cambiar
 * de espacio» (design `e1-06`), and from there joining (e1-02/03), creating
 * (e1-04) and inviting (e1-05); the space's channels (e2-15/16). The space open
 * is remembered; one left or where access was removed falls back to personal.
 */
export function useSpacesUi(params: { jwt: string; me: { name: string; phone: string }; personalUnread: number; onOpenChat: (chat: ChatSummary) => void }) {
  const { jwt, onOpenChat } = params;
  const colors = useColores();
  const currentId = useCurrentSpaceId();
  const { spaces, reload } = useMySpaces(jwt);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [inviting, setInviting] = useState<ClientWorkspace | null>(null);
  const current = spaces?.find((space) => space.id === currentId && space.status === 'active') ?? null;

  // A space I left, or where access was removed: back to personal.
  useEffect(() => {
    if (spaces && currentId && !current) setCurrentSpaceId(null);
  }, [spaces, currentId, current]);

  const enter = useCallback(async (spaceId: string | null) => {
    setSheet(null);
    // The list first: a space just created or joined is not in the old one, and the fallback above would send it back to personal.
    if (spaceId) await reload();
    setCurrentSpaceId(spaceId);
  }, [reload]);
  const openChannel = useCallback((channel: ClientChannel) => {
    setSheet(null);
    if (current) onOpenChat(chatOfChannel(channel, current.id));
  }, [current, onOpenChat]);

  const title: ReactNode = (
    <Pressable testID="titulo-espacio" accessibilityLabel="Cambiar de espacio" onPress={() => setSheet('switcher')} className="min-h-[44px] flex-1 flex-row items-center gap-2.5">
      {current ? <SpaceLogo space={current} size={36} /> : <Logo tamano={32} />}
      <View className="min-w-0 flex-shrink">
        <View className="flex-row items-center gap-1">
          <Text numberOfLines={1} className={`text-[22px] font-bold ${current ? 'text-on-surface' : 'text-primary'}`}>{current ? current.name : 'Lilachat'}</Text>
          <ChevronDown size={18} color={colors['on-surface-variant']} />
        </View>
        {current ? <Text className="-mt-0.5 text-[12px] text-on-surface-variant">{spaceSubtitle(current, { membersFirst: true })}</Text> : null}
      </View>
    </Pressable>
  );

  const layer: ReactNode = (
    <>
      <SpaceSwitcherSheet
        visible={sheet === 'switcher'}
        spaces={spaces}
        currentId={current?.id ?? null}
        me={params.me}
        personalUnread={params.personalUnread}
        onPick={(spaceId) => void enter(spaceId)}
        onJoin={() => setSheet('join')}
        onCreate={() => setSheet('create')}
        onClose={() => setSheet(null)}
        onOpen={() => void reload()}
      />
      <JoinSpaceScreen visible={sheet === 'join'} jwt={jwt} onJoined={(spaceId) => void enter(spaceId)} onClose={() => { setSheet(null); void reload(); }} />
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
    </>
  );

  return { current, title, layer, openChannels: () => setSheet('channels'), openInvite: () => setSheet('invite') };
}
