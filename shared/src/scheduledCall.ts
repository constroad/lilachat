import { LILACHAT_WEB_URL } from './spaceSections.js';

/**
 * Scheduled calls and call links (pending 42, José 22/10), like WhatsApp.
 * A scheduled call is an event of a 1:1 chat with `call`; its card offers
 * «Unirse» from a little before the time. PURE.
 */
export const CALL_JOIN_EARLY_MS = 10 * 60_000;
export const CALL_JOIN_LATE_MS = 60 * 60_000;

export type CallJoinState = 'early' | 'open' | 'over';

/** When «Unirse» opens and closes; null for a date it cannot read. */
function joinWindow(startsAt: string, endsAt?: string): { opens: number; closes: number } | null {
  const start = Date.parse(startsAt);
  if (Number.isNaN(start)) return null;
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;
  return { opens: start - CALL_JOIN_EARLY_MS, closes: Number.isNaN(end) ? start + CALL_JOIN_LATE_MS : Math.max(end, start + CALL_JOIN_LATE_MS) };
}

export function callJoinState(startsAt: string, now: number, endsAt?: string): CallJoinState {
  const range = joinWindow(startsAt, endsAt);
  if (!range) return 'over';
  if (now < range.opens) return 'early';
  return now <= range.closes ? 'open' : 'over';
}

/** How long until the card must change (opens or closes), to wake it then instead of ticking. */
export function msUntilJoinChange(startsAt: string, now: number, endsAt?: string): number | null {
  const range = joinWindow(startsAt, endsAt);
  if (!range || now > range.closes) return null;
  return now < range.opens ? range.opens - now : range.closes - now + 1;
}

export const scheduledCallTitle = (name: string, video: boolean): string => `${video ? 'Videollamada' : 'Llamada'} con ${name.trim()}`;

/** The line in the chat and in the list. */
export const scheduledCallText = (title: string): string => `Llamada programada: ${title.trim()}`;

const CALL_LINK = /^https:\/\/lilachat\.constroad\.com\/llamada\/([A-Za-z0-9_-]+)/;

export const callLinkUrl = (token: string): string => `${LILACHAT_WEB_URL}/llamada/${token}`;

/** The token of a call link, or null for any other address. A regex, not `URL`: React Native's is incomplete. */
export function callLinkTokenOf(url: string | null | undefined): string | null {
  return CALL_LINK.exec(url ?? '')?.[1] ?? null;
}

/** Less than this before the time, the person would not see the invitation in time. */
const MIN_AHEAD_MS = 15 * 60_000;

/** The default time of a scheduled call: the next round half hour, at least 15 minutes from now. */
export function nextHalfHour(now: Date): Date {
  const rounded = new Date(now.getTime() + MIN_AHEAD_MS);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  if (minutes !== 0 && minutes !== 30) rounded.setMinutes(minutes < 30 ? 30 : 60);
  return rounded;
}
