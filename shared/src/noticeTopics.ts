/**
 * Notice topics (R160, design e-31; José, 23/10: how do we say which channel
 * the attendance notices go to?). The app declares its topics in the
 * manifest; the space's admin picks a channel for each inside Lilachat, and
 * the app posts by topic. Lilachat keeps the routing: no channel ids in agentes.
 */
export const NOTICE_ICONS = ['attendance', 'tank', 'material', 'truck', 'weather', 'cash', 'document', 'alert'] as const;
export type NoticeIcon = (typeof NOTICE_ICONS)[number];
export type NoticeTopic = { key: string; name: string; description?: string; icon?: NoticeIcon };
/** A topic with where its notices land; null = «Sin canal», they are not posted. */
export type TopicRoute = NoticeTopic & { channel: { id: string; name: string } | null };

export const NOTICE_TOPIC_LIMITS = { topics: 10, key: 32, name: 40, description: 80 };
export const TOPIC_KEY = /^[a-z][a-z0-9_-]*$/;
const OBJECT_ID = /^[a-f0-9]{24}$/;

export const isNoticeIcon = (value: unknown): value is NoticeIcon => typeof value === 'string' && (NOTICE_ICONS as readonly string[]).includes(value);

/** `{ asistencia: '<channel id>', caja: null }`, only for topics the app has; what is not sent keeps its value. */
export function validateTopicChannels(raw: unknown, known: readonly string[]): { ok: true; channels: Record<string, string | null> } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'Manda un objeto { tema: id_del_canal | null }.' };
  const channels: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.includes(key)) return { ok: false, message: `La app no tiene el tema «${key}».` };
    if (value !== null && (typeof value !== 'string' || !OBJECT_ID.test(value))) return { ok: false, message: `El canal de «${key}» va como id o null.` };
    channels[key] = value as string | null;
  }
  return { ok: true, channels };
}
