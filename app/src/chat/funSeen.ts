import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { funPlayedFloor, parseFunLedger, recordFunPlayed, serializeFunLedger, type FunLedger } from '@lilachat/shared';

/**
 * The newest message each chat already reached on THIS phone (José, 22/10:
 * Lila's bear played on every visit; 28/10, pending 107: Lila's nudge to
 * «Lokillos» played again on coming back, on opening the chat and after
 * reopening the app). It used to live in memory: a restart forgot it and the
 * chat fell back to the read cursor, which lags in groups and channels. Now it
 * is saved (`funLedger` in shared). «Ver otra vez» does not go through it.
 */
const STORAGE_KEY = 'lilachat.funPlayed';
const SAVE_DELAY_MS = 1000;

let ledger: FunLedger = {};
let ready = false;
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Rows that shook in this session: a reloaded or recycled row must not shake again. */
const rowPlayed = new Map<string, number>();
const listeners = new Set<() => void>();

export function loadFunLedger(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      // Anything recorded before storage answered is kept: each chat keeps its higher seq.
      let merged = parseFunLedger(stored);
      for (const [chatId, entry] of Object.entries(ledger)) merged = recordFunPlayed(merged, chatId, entry.seq, entry.at);
      ledger = merged;
    })
    .catch((error: unknown) => console.warn('[fun] no se pudo leer lo ya reproducido:', error instanceof Error ? error.message : error))
    .finally(() => {
      ready = true;
      listeners.forEach((listener) => listener());
    });
  return loading;
}

export const funLedgerReady = (): boolean => ready;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** True once what was played before is known: until then nothing plays on its own. */
export function useFunLedgerReady(): boolean {
  useEffect(() => {
    void loadFunLedger();
  }, []);
  return useSyncExternalStore(subscribe, funLedgerReady);
}

export function funSeenFloor(chatId: string, readSeqAtOpen: number): number {
  return funPlayedFloor(ledger, chatId, readSeqAtOpen);
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, serializeFunLedger(ledger)).catch((error: unknown) => console.warn('[fun] no se pudo guardar lo ya reproducido:', error instanceof Error ? error.message : error));
  }, SAVE_DELAY_MS);
}

export function rememberFunSeen(chatId: string, seq: number): void {
  const next = recordFunPlayed(ledger, chatId, seq, Date.now());
  if (next === ledger) return;
  ledger = next;
  scheduleSave();
}

export function rowPlayedSeq(chatId: string): number {
  return Math.max(rowPlayed.get(chatId) ?? 0, ledger[chatId]?.seq ?? 0);
}

export function rememberRowPlayed(chatId: string, seq: number): void {
  if (seq > (rowPlayed.get(chatId) ?? 0)) rowPlayed.set(chatId, seq);
}
