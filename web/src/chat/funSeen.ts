import { funPlayedFloor, parseFunLedger, recordFunPlayed, serializeFunLedger, type FunLedger } from '@lilachat/shared';

/**
 * The newest message each chat already reached in THIS browser (pending 107,
 * José 28/10: a nudge played again on coming back and after reloading). The
 * read cursor lags in groups and channels, so it cannot be the only floor.
 * Every write starts from what is stored: two open tabs do not erase each
 * other. «Ver otra vez» does not go through it.
 */
const STORAGE_KEY = 'lilachat.funPlayed';

let ledger: FunLedger = readStored();
/** Rows that played in this tab: a re-rendered row must not shake again. */
const rowPlayed = new Map<string, number>();

function readStored(): FunLedger {
  try {
    return parseFunLedger(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

export function funSeenFloor(chatId: string, readSeqAtOpen: number): number {
  return funPlayedFloor(ledger, chatId, readSeqAtOpen);
}

export function rememberFunSeen(chatId: string, seq: number): void {
  if (seq <= (ledger[chatId]?.seq ?? 0)) return;
  let next = recordFunPlayed(readStored(), chatId, seq, Date.now());
  for (const [id, entry] of Object.entries(ledger)) next = recordFunPlayed(next, id, entry.seq, entry.at);
  ledger = next;
  try {
    localStorage.setItem(STORAGE_KEY, serializeFunLedger(ledger));
  } catch {
    // Private mode or a full storage: this tab still remembers it in memory.
  }
}

export function rowPlayedSeq(chatId: string): number {
  return Math.max(rowPlayed.get(chatId) ?? 0, ledger[chatId]?.seq ?? 0);
}

export function rememberRowPlayed(chatId: string, seq: number): void {
  if (seq > (rowPlayed.get(chatId) ?? 0)) rowPlayed.set(chatId, seq);
}
