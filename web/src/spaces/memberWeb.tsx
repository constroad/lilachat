import { formatPhoneDisplay, roleLabel, type ClientWorkspaceMember, type WorkspaceRole } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';

/** A person of the space by their name, or by their number while they have none. */
export const memberName = (member: Pick<ClientWorkspaceMember, 'name' | 'phone'>): string => member.name?.trim() || formatPhoneDisplay(member.phone);

/** «Residente de obra · Obra», or nothing. */
export const memberLine = (member: Pick<ClientWorkspaceMember, 'title' | 'area'>): string => [member.title, member.area].filter(Boolean).join(' · ');

/** The role as a pill (designs `e1-09`, `e1-10`): the owner filled, the rest outlined. */
export function RolePill({ role }: { role: WorkspaceRole }) {
  const tone = role === 'owner' ? 'border-primary bg-primary text-on-primary' : role === 'admin' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline/30 text-on-surface-variant';
  return <span className={`rounded-md border px-1.5 text-[10px] font-bold uppercase leading-5 ${tone}`}>{roleLabel(role)}</span>;
}

export const OnlinePill = () => <span className="rounded-md border border-en-linea/40 bg-en-linea/10 px-1.5 text-[10px] font-bold leading-5 text-en-linea">EN LÍNEA</span>;

export function MemberAvatar({ member, size, online }: { member: Pick<ClientWorkspaceMember, 'name' | 'phone' | 'avatarUrl'>; size: number; online: boolean }) {
  return <Avatar name={memberName(member)} foto={member.avatarUrl} size={size} online={online || undefined} />;
}
