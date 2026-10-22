import type { ActivityItem, ActivityType, ClientChannel, ClientWorkspace, ClientWorkspaceMember } from '@lilachat/shared';
import { ActivityDialog } from '../activity/ActivityDialog';
import type { ChatSummary } from '../chat/types';
import { SpaceSwitcher } from './SpaceSwitcher';
import { JoinSpaceDialog } from './JoinSpaceDialog';
import { CreateSpaceDialog } from './CreateSpaceDialog';
import { InviteToSpaceDialog } from './InviteToSpaceDialog';
import { ChannelsDialog } from './ChannelsDialog';
import { DirectoryDialog } from './DirectoryDialog';
import { MemberProfileDialog } from './MemberProfileDialog';
import { MembersDialog } from './MembersDialog';
import { SpaceSettingsDialog } from './SpaceSettingsDialog';
import { NewSpaceGroupDialog } from './NewSpaceGroupDialog';
import { AddedToSpaceDialog } from './AddedToSpaceDialog';
import { AccessRemovedDialog } from './AccessRemovedDialog';

export type SpaceDialog = 'switcher' | 'join' | 'create' | 'invite' | 'channels' | 'directory' | 'members' | 'requests' | 'settings' | 'newDirect' | 'newGroup' | null;
type Admin = { userId: string; name?: string; phone: string };

/** Every dialog of the company spaces on the web, as `useSpacesWeb` decides which one shows. */
export function SpacesLayer(props: {
  jwt: string;
  myUserId: string;
  me: { name?: string | null; phone: string };
  personalUnread: number;
  online: ReadonlySet<string>;
  spaces: ClientWorkspace[] | null;
  current: ClientWorkspace | null;
  dialog: SpaceDialog;
  invitee: ClientWorkspace | null;
  profile: ClientWorkspaceMember | null;
  welcome: ClientWorkspace | null;
  removed: ClientWorkspace | null;
  activityTab: ActivityType | null;
  spaceChats: ChatSummary[];
  on: {
    dialog: (next: SpaceDialog) => void;
    enter: (spaceId: string | null) => void;
    reload: () => void;
    created: (space: ClientWorkspace) => void;
    closeInvite: () => void;
    channel: (channel: ClientChannel) => void;
    profile: (member: ClientWorkspaceMember | null) => void;
    writeTo: (member: ClientWorkspaceMember) => void;
    groupCreated: (chat: { id: string; name: string; memberIds: string[] }) => void;
    welcomeSeen: (then?: 'enter' | 'directory') => void;
    removedSeen: () => void;
    talkTo: (admin: Admin) => void;
    activity: (tab: ActivityType | null) => void;
    activityItem: (item: ActivityItem) => void;
  };
}) {
  const { jwt, current, dialog, on } = props;
  const close = () => on.dialog(null);
  const commonChannels = props.profile?.userId ? props.spaceChats.filter((chat) => chat.channel && chat.memberIds.includes(props.profile!.userId!)).map((chat) => chat.name ?? '') : [];
  return (
    <>
      {dialog === 'switcher' ? <SpaceSwitcher spaces={props.spaces} currentId={current?.id ?? null} me={props.me} personalUnread={props.personalUnread} onPick={on.enter} onJoin={() => on.dialog('join')} onCreate={() => on.dialog('create')} onClose={close} onOpen={on.reload} /> : null}
      {dialog === 'join' ? <JoinSpaceDialog jwt={jwt} onJoined={on.enter} onClose={() => { close(); on.reload(); }} /> : null}
      {dialog === 'create' ? <CreateSpaceDialog jwt={jwt} onJoinInstead={() => on.dialog('join')} onCreated={on.created} onClose={close} /> : null}
      {props.invitee ? <InviteToSpaceDialog space={props.invitee} jwt={jwt} inviterName={props.me.name ?? undefined} onClose={on.closeInvite} /> : null}
      {current && dialog === 'channels' ? <ChannelsDialog space={current} jwt={jwt} onOpenChannel={on.channel} onClose={close} /> : null}
      {current && (dialog === 'directory' || dialog === 'newDirect') ? (
        <DirectoryDialog space={current} jwt={jwt} myUserId={props.myUserId} online={props.online} picking={dialog === 'newDirect'} onOpenMember={on.profile} onMessage={on.writeTo} onInvite={current.joinCode ? () => on.dialog('invite') : undefined} onClose={close} />
      ) : null}
      {current && props.profile ? (
        <MemberProfileDialog space={current} member={props.profile} isMe={props.profile.userId === props.myUserId} online={Boolean(props.profile.userId && props.online.has(props.profile.userId))} commonChannels={commonChannels} onMessage={() => on.writeTo(props.profile!)} onClose={() => on.profile(null)} />
      ) : null}
      {current && (dialog === 'members' || dialog === 'requests') ? (
        <MembersDialog space={current} jwt={jwt} myUserId={props.myUserId} online={props.online} initialTab={dialog === 'requests' ? 'pending' : 'active'} onInvite={() => on.dialog('invite')} onChanged={on.reload} onClose={close} />
      ) : null}
      {current && dialog === 'settings' ? <SpaceSettingsDialog space={current} jwt={jwt} onSaved={on.reload} onClose={close} /> : null}
      {current && dialog === 'newGroup' ? <NewSpaceGroupDialog space={current} jwt={jwt} myUserId={props.myUserId} onCreated={on.groupCreated} onClose={close} /> : null}
      {props.welcome && !dialog ? <AddedToSpaceDialog space={props.welcome} jwt={jwt} onEnter={() => on.welcomeSeen('enter')} onDirectory={() => on.welcomeSeen('directory')} onLater={() => on.welcomeSeen()} /> : null}
      {current && props.activityTab ? <ActivityDialog spaceId={current.id} spaceName={current.name} jwt={jwt} myUserId={props.myUserId} initialTab={props.activityTab} onOpen={on.activityItem} onClose={() => on.activity(null)} /> : null}
      {props.removed ? <AccessRemovedDialog space={props.removed} onPersonal={on.removedSeen} onTalkTo={on.talkTo} /> : null}
    </>
  );
}
