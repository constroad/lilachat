import { isGroupMentionId } from './menciones.js';
import type { Reaccion } from './reacciones.js';
import { compareOrdinal } from './compareText.js';

/** A mention inside a message's text: who, and where in the text. */
type MessageMention = import('./menciones.js').MencionEnMensaje;

/**
 * «Menciones y actividad» (design `e-19-menciones-actividad`): the mentions
 * of me (by name or by a group mention), the threads I am in, and the reactions of
 * others to my messages — of a space or of the personal account — by day.
 * PURE.
 */
export type ActivityType = 'mentions' | 'threads' | 'reactions';

export const ACTIVITY_TABS: readonly { type: ActivityType; label: string }[] = [
  { type: 'mentions', label: 'Menciones' },
  { type: 'threads', label: 'Hilos' },
  { type: 'reactions', label: 'Reacciones' },
];

export const activityType = (value: unknown): ActivityType => ACTIVITY_TABS.find((tab) => tab.type === value)?.type ?? 'mentions';

/** One row of the activity, as `GET /api/activity` returns it. */
export type ActivityItem = {
  chatId: string;
  seq: number;
  /** When it happened: the message, the last reply of the thread or the last reaction. */
  at: string;
  chat: { kind: 'direct' | 'group'; name?: string; phone?: string; channel?: boolean };
  author: { id: string; name?: string; phone?: string };
  body?: string;
  menciones?: MessageMention[];
  unread: boolean;
  thread?: { replies: number; lastAt?: string };
  reactions?: { emoji: string; count: number }[];
};

export const mentionsMe = (menciones: readonly MessageMention[] | undefined, me: string): boolean =>
  Boolean(menciones?.some((mention) => mention.userId === me || isGroupMentionId(mention.userId)));

/** The reactions of others to my message by emoji (the most used first), and who reacted last; `null` if only mine. */
export function reactionsFromOthers(reactions: readonly Reaccion[], me: string): { groups: { emoji: string; count: number; userIds: string[] }[]; latestAt?: string; latestBy: string } | null {
  const others = reactions.filter((reaction) => reaction.userId !== me);
  if (others.length === 0) return null;
  const groups = new Map<string, string[]>();
  for (const reaction of others) groups.set(reaction.emoji, [...(groups.get(reaction.emoji) ?? []), reaction.userId]);
  const latest = [...others].sort((a, b) => compareOrdinal(b.en ?? '', a.en ?? ''))[0]!;
  return {
    groups: [...groups.entries()].map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds })).sort((a, b) => b.count - a.count),
    ...(latest.en ? { latestAt: latest.en } : {}),
    latestBy: latest.userId,
  };
}

/** Peru has no daylight saving: Lima is always five hours behind UTC. */
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const limaDay = (date: Date) => Math.floor((date.getTime() + LIMA_OFFSET_MS) / DAY_MS);

/** By day in Lima: «Hoy», «Ayer», «Esta semana» (the last seven days) and «Anteriores», newest first. */
export function activityDaySections<T extends { at: string }>(items: readonly T[], now: Date): { title: string; items: T[] }[] {
  const today = limaDay(now);
  const titleOf = (at: string) => {
    const days = today - limaDay(new Date(at));
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return days < WEEK_DAYS ? 'Esta semana' : 'Anteriores';
  };
  const sections: { title: string; items: T[] }[] = [];
  for (const item of items) {
    const title = titleOf(item.at);
    const last = sections.at(-1);
    if (last?.title === title) last.items.push(item);
    else sections.push({ title, items: [item] });
  }
  return sections;
}
