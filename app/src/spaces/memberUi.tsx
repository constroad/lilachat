import { Text, View } from 'react-native';
import { formatPhoneDisplay, roleLabel, type ClientWorkspaceMember, type WorkspaceRole } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';

/** A person of the space by their name, or by their number while they have none. */
export const memberName = (member: Pick<ClientWorkspaceMember, 'name' | 'phone'>): string => member.name?.trim() || formatPhoneDisplay(member.phone);

/** «Residente de obra · Obra», or nothing. */
export const memberLine = (member: Pick<ClientWorkspaceMember, 'title' | 'area'>): string => [member.title, member.area].filter(Boolean).join(' · ');

/** The role as a pill (designs `e1-09`, `e1-10`): the owner filled, the rest outlined. */
export function RolePill({ role }: { role: WorkspaceRole }) {
  const owner = role === 'owner';
  return <Text className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${owner ? 'border-primary bg-primary text-on-primary' : role === 'admin' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline/30 text-on-surface-variant'}`}>{roleLabel(role)}</Text>;
}

export function OnlinePill() {
  return <Text className="rounded-md border border-en-linea/40 bg-en-linea/10 px-1.5 py-0.5 text-[10px] font-bold text-en-linea">EN LÍNEA</Text>;
}

/** The avatar with the presence dot at its corner. */
export function MemberAvatar({ member, size, online }: { member: Pick<ClientWorkspaceMember, 'name' | 'phone' | 'avatarUrl'>; size: number; online: boolean }) {
  const dot = Math.max(10, Math.round(size / 4));
  return (
    <View>
      <Avatar nombre={memberName(member)} foto={member.avatarUrl} tamano={size} />
      {online ? <View className="absolute bottom-0 right-0 rounded-full border-2 border-background bg-en-linea" style={{ width: dot, height: dot }} /> : null}
    </View>
  );
}
