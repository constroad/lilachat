import { Types } from 'mongoose';
import { ReceiptModel } from './chatModels.js';

/**
 * Where each person read each thread (José, 16/11: after opening the app he
 * could not tell where people had answered; Slack can). Thread replies are hidden from the chat, so
 * reading the chat cannot mean reading its threads: each root keeps its own
 * cursor, in the person's receipt of that chat (`threadSeq`, root → seq; no
 * new collection nor index). Opening a thread moves it; it never goes back.
 */

/**
 * Threads whose last reply is older than this have no cursor yet (nobody
 * could open them with one): they keep the old rule, read with the chat.
 */
export const THREAD_READ_SINCE = new Date('2026-11-16T12:00:00Z');

type ThreadSummary = { ultimaSeq?: number; ultimaEn?: Date | string; autores?: readonly string[] };

/** Read up to `seq` in this thread. Integer roots and seqs only. */
export async function markThreadRead(userId: Types.ObjectId, chatId: Types.ObjectId, root: number, seq: number): Promise<void> {
  if (!Number.isInteger(root) || root <= 0 || !Number.isInteger(seq) || seq <= 0) return;
  await ReceiptModel.updateOne({ chatId, userId }, { $max: { [`threadSeq.${root}`]: seq } }, { upsert: true });
}

/** How far this person read a thread: its cursor, or the chat's for a thread from before the cursors. */
export function threadReadUpTo(thread: ThreadSummary, cursor: number | undefined, chatReadSeq: number): number {
  if (cursor !== undefined) return cursor;
  const lastAt = thread.ultimaEn ? new Date(thread.ultimaEn) : null;
  return lastAt && lastAt < THREAD_READ_SINCE ? chatReadSeq : 0;
}

/** A thread is new for me while its last reply is after what I read and was not mine. */
export function threadHasNewReplies(thread: ThreadSummary, readUpTo: number, me: string): boolean {
  return (thread.ultimaSeq ?? 0) > readUpTo && thread.autores?.at(-1) !== me;
}

/** A receipt's cursors as a plain map (lean gives an object; a hydrated doc, a Map). */
export function threadCursorsOf(raw: unknown): Map<number, number> {
  const entries = raw instanceof Map ? [...raw.entries()] : raw && typeof raw === 'object' ? Object.entries(raw) : [];
  return new Map(entries.flatMap(([root, seq]) => (Number.isInteger(Number(root)) && typeof seq === 'number' ? [[Number(root), seq] as [number, number]] : [])));
}
