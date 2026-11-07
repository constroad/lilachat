import { Types } from 'mongoose';
import { canManageMembers, RESTRICTABLE_TABS, type MemberAccess, type MyClientAccess, type RestrictableTab, type StageScope } from '@lilachat/shared';
import type { Checklist } from './checklistModel.js';
import { ClientChannelModel, type ClientChannel, type RestrictedMember } from './bots/botClients.js';
import { WorkspaceMemberModel } from './workspaceModels.js';

/**
 * José 30/10 night: in a client's channel a restricted member sees only the
 * tabs an admin picked. José 06/11: the checklist is run by the space's admins;
 * «Pendientes» is for everyone, so anyone in the channel reads the stages and
 * touches only the tasks assigned to them. The checklist routes and the
 * questions to the app ask here.
 */
const tabsOf = (tabs: readonly string[]): RestrictableTab[] => RESTRICTABLE_TABS.filter((tab) => tabs.includes(tab));
export const memberAccessFrom = (entry: Pick<RestrictedMember, 'tabs' | 'stages'>): MemberAccess => ({ tabs: tabsOf(entry.tabs), stages: [...entry.stages] });

/** My access in a client's channel: a space admin sees everything, money included. */
export function accessOf(client: Partial<Pick<ClientChannel, 'billingViewers' | 'restrictedMembers'>>, userId: Types.ObjectId, isAdmin: boolean): MyClientAccess {
  if (isAdmin) return { money: true, admin: true };
  const money = (client.billingViewers ?? []).some((one) => one.equals(userId));
  const entry = (client.restrictedMembers ?? []).find((one) => one.userId.equals(userId));
  return entry ? { money, restricted: memberAccessFrom(entry) } : { money };
}

/** A space admin runs the plan of a client's channel; a chat that is not a client's has no such limit. */
export async function runsChecklist(chatId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
  const client = await ClientChannelModel.findOne({ chatId }).select('workspaceId').lean();
  if (!client) return true;
  const member = await WorkspaceMemberModel.findOne({ workspaceId: client.workspaceId, userId, status: 'active' }).select('role').lean();
  return Boolean(member && canManageMembers(member.role));
}

const isMine = (assignee: unknown, userId: Types.ObjectId) => Boolean(assignee) && String(assignee) === String(userId);

/** What the member may touch of this checklist; a checklist that is not a stage is always whole. */
export async function stageScopeFor(checklist: Pick<Checklist, 'chatId' | 'stage'>, userId: Types.ObjectId): Promise<StageScope> {
  if (checklist.stage === undefined || checklist.stage === null) return 'full';
  return (await runsChecklist(checklist.chatId, userId)) ? 'full' : 'own';
}

/** The stage with only the tasks assigned to the member. */
export const ownTasksOnly = <T extends Pick<Checklist, 'items'>>(checklist: T, userId: Types.ObjectId): T => ({ ...checklist, items: checklist.items.filter((item) => isMine(item.assignee, userId)) });
