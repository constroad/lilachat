import { Types } from 'mongoose';
import { RESTRICTABLE_TABS, stageScopeOf, type MemberAccess, type MyClientAccess, type RestrictableTab, type StageScope } from '@lilachat/shared';
import type { Checklist } from './checklistModel.js';
import { ClientChannelModel, type ClientChannel, type RestrictedMember } from './bots/botClients.js';

/**
 * José 30/10 night: in a client's channel a restricted member sees only the
 * tabs and checklist stages an admin picked, plus the tasks assigned to them.
 * The checklist routes and the questions to the app ask here.
 */
const tabsOf = (tabs: readonly string[]): RestrictableTab[] => RESTRICTABLE_TABS.filter((tab) => tabs.includes(tab));
export const memberAccessFrom = (entry: Pick<RestrictedMember, 'tabs' | 'stages'>): MemberAccess => ({ tabs: tabsOf(entry.tabs), stages: [...entry.stages] });

/** My access in a client's channel: a space admin sees everything, money included. */
export function accessOf(client: Partial<Pick<ClientChannel, 'billingViewers' | 'restrictedMembers'>>, userId: Types.ObjectId, isAdmin: boolean): MyClientAccess {
  if (isAdmin) return { money: true };
  const money = (client.billingViewers ?? []).some((one) => one.equals(userId));
  const entry = (client.restrictedMembers ?? []).find((one) => one.userId.equals(userId));
  return entry ? { money, restricted: memberAccessFrom(entry) } : { money };
}

/** The member's restriction in this chat, or `null` when the chat is not a client's or they see all of it. */
export async function restrictionIn(chatId: Types.ObjectId, userId: Types.ObjectId): Promise<MemberAccess | null> {
  const client = await ClientChannelModel.findOne({ chatId, 'restrictedMembers.userId': userId }).select('restrictedMembers').lean<Pick<ClientChannel, 'restrictedMembers'> | null>();
  const entry = client?.restrictedMembers.find((one) => one.userId.equals(userId));
  return entry ? memberAccessFrom(entry) : null;
}

const isMine = (assignee: unknown, userId: Types.ObjectId) => Boolean(assignee) && String(assignee) === String(userId);

/** How much of this checklist the member sees; a checklist that is not a stage is always whole. */
export async function stageScopeFor(checklist: Pick<Checklist, '_id' | 'chatId' | 'stage' | 'items'>, userId: Types.ObjectId): Promise<StageScope> {
  if (checklist.stage === undefined || checklist.stage === null) return 'full';
  const restricted = await restrictionIn(checklist.chatId, userId);
  return stageScopeOf(restricted, String(checklist._id), checklist.items.some((item) => isMine(item.assignee, userId)));
}

/** The stage with only the tasks assigned to the member. */
export const ownTasksOnly = <T extends Pick<Checklist, 'items'>>(checklist: T, userId: Types.ObjectId): T => ({ ...checklist, items: checklist.items.filter((item) => isMine(item.assignee, userId)) });
