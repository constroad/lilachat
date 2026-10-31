import { Types } from 'mongoose';
import { chatMemberIds } from './chatService.js';

/** How long a chat's members are trusted for «escribiendo…»: a member just removed still shows typing that long. */
export const TYPING_MEMBERS_TTL_MS = 10_000;
/** Chats kept at once; the oldest leaves first. */
export const TYPING_MAX_CHATS = 2_000;

type MembersReader = (chatId: string) => Promise<string[]>;

/**
 * The members of a chat for «escribiendo…» (FL4 debt): it fires on every
 * keystroke burst, so the list is kept a few seconds instead of one query each
 * time. Only for this decorative signal: messages, receipts and calls still
 * read the base.
 */
export function createMembersCache(options: { read: MembersReader; now?: () => number; ttlMs?: number; maxChats?: number }): MembersReader {
  const { read, now = Date.now, ttlMs = TYPING_MEMBERS_TTL_MS, maxChats = TYPING_MAX_CHATS } = options;
  const cache = new Map<string, { at: number; members: string[] }>();
  return async (chatId) => {
    const kept = cache.get(chatId);
    if (kept && now() - kept.at < ttlMs) return kept.members;
    const members = await read(chatId);
    cache.delete(chatId);
    cache.set(chatId, { at: now(), members });
    if (cache.size > maxChats) cache.delete(cache.keys().next().value as string);
    return members;
  };
}

/**
 * Who sees that I am typing (R31/10): the other members, and nobody when I am
 * not one. Before, anyone who knew a chat's id made «escribiendo…» show there.
 */
export async function typingTargets(chatId: unknown, userId: string, members: MembersReader): Promise<string[]> {
  if (typeof chatId !== 'string' || !Types.ObjectId.isValid(chatId)) return [];
  const list = await members(chatId);
  if (!list.includes(userId)) return [];
  return list.filter((member) => member !== userId);
}

/** The cache the socket uses. */
export const typingMembers = createMembersCache({ read: (chatId) => chatMemberIds(new Types.ObjectId(chatId)) });
