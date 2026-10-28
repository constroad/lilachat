import { FUN_LIVE_MS } from './winks.js';

/**
 * What this device already played on its own, per chat: the newest nudge or
 * wink seq (pending 107, José 28/10: Lila's nudge to «Lokillos» played again
 * on coming back to the list, on opening the chat and after reopening the
 * app). The guard used to live in memory and fell back to the read cursor,
 * which lags in groups and channels (pending 108): a restart or a stale cursor
 * replayed it. The app keeps this in AsyncStorage and the web in
 * localStorage. «Ver otra vez» does not go through it.
 */
export type FunLedger = Readonly<Record<string, { seq: number; at: number }>>;

/** Chats remembered; past it, the one played longest ago is forgotten. */
export const FUN_LEDGER_MAX = 300;

export function funPlayedFloor(ledger: FunLedger, chatId: string, readSeq: number): number {
  return Math.max(readSeq, ledger[chatId]?.seq ?? 0);
}

export function recordFunPlayed(ledger: FunLedger, chatId: string, seq: number, now: number): FunLedger {
  if (seq <= (ledger[chatId]?.seq ?? 0)) return ledger;
  const next: Record<string, { seq: number; at: number }> = { ...ledger, [chatId]: { seq, at: now } };
  const ids = Object.keys(next);
  if (ids.length > FUN_LEDGER_MAX) {
    ids
      .sort((left, right) => next[left]!.at - next[right]!.at)
      .slice(0, ids.length - FUN_LEDGER_MAX)
      .forEach((id) => delete next[id]);
  }
  return next;
}

export function serializeFunLedger(ledger: FunLedger): string {
  return JSON.stringify(ledger);
}

export function parseFunLedger(stored: string | null): FunLedger {
  if (!stored) return {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const ledger: Record<string, { seq: number; at: number }> = {};
    for (const [chatId, entry] of Object.entries(parsed as Record<string, unknown>)) {
      const { seq, at } = (entry ?? {}) as { seq?: unknown; at?: unknown };
      if (typeof seq === 'number' && typeof at === 'number') ledger[chatId] = { seq, at };
    }
    return ledger;
  } catch {
    return {};
  }
}

/**
 * A nudge or wink a row of the chat list plays: someone else's, just sent
 * (`FUN_LIVE_MS`), and not played here yet. Live is what decides: the list
 * reloads, remounts and recycles rows, and an old one must not shake again.
 */
export function funToPlayInRow(params: { last: { seq: number; kind?: string; senderId: string; at?: string; deletedAt?: string } | null | undefined; me: string; playedSeq: number; now: number }): 'zumbido' | 'guino' | null {
  const { last, me, playedSeq, now } = params;
  if (!last || last.senderId === me || last.deletedAt || last.seq <= playedSeq) return null;
  if (last.kind !== 'zumbido' && last.kind !== 'guino') return null;
  const sentAt = last.at ? Date.parse(last.at) : Number.NaN;
  return Number.isFinite(sentAt) && sentAt >= now - FUN_LIVE_MS ? last.kind : null;
}
