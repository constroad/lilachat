import { formatBytes } from './media.js';

/**
 * Storage, like WhatsApp's «Administrar almacenamiento» (pending 13): what a
 * chat weighs by kind and the files over 5 MB. Sizes are written with
 * `formatBytes`, like everywhere else in the app. PURE.
 */
export type StorageKind = 'image' | 'video' | 'audio' | 'file';
/** How the chat is shown: its name, or the other person's phone in a 1:1 (the app puts the phone book name). */
export type StorageChatLabel = { kind: 'direct' | 'group'; name?: string; phone?: string };
export type StorageChat = { chatId: string; bytes: number; count: number; byKind: Partial<Record<StorageKind, number>>; chat?: StorageChatLabel };
export type BigFile = { chatId: string; seq: number; kind: StorageKind; bytes: number; fileName?: string; at: string; chat?: StorageChatLabel };
export type StorageReport = { chats: StorageChat[]; bigFiles: BigFile[] };

export const STORAGE_KINDS: readonly StorageKind[] = ['image', 'video', 'audio', 'file'];
export const BIG_FILE_BYTES = 5 * 1024 * 1024;
const KIND_LABEL: Record<StorageKind, string> = { image: 'Fotos', video: 'Videos', audio: 'Audios', file: 'Documentos' };
/** «Videos 1.1 GB · Fotos 320 MB»: the two kinds that weigh the most. */
export function kindBreakdown(byKind: Partial<Record<StorageKind, number>>): string {
  return STORAGE_KINDS.filter((kind) => (byKind[kind] ?? 0) > 0)
    .sort((first, second) => (byKind[second] ?? 0) - (byKind[first] ?? 0))
    .slice(0, 2)
    .map((kind) => `${KIND_LABEL[kind]} ${formatBytes(byKind[kind] ?? 0)}`)
    .join(' · ');
}

/** The server's sums per chat and kind, folded into one row per chat, heaviest first. */
export function foldStorageRows(rows: readonly { chatId: string; kind: StorageKind; bytes: number; count: number }[]): StorageChat[] {
  const chats = new Map<string, StorageChat>();
  for (const row of rows) {
    const chat = chats.get(row.chatId) ?? { chatId: row.chatId, bytes: 0, count: 0, byKind: {} };
    chat.bytes += row.bytes;
    chat.count += row.count;
    chat.byKind[row.kind] = (chat.byKind[row.kind] ?? 0) + row.bytes;
    chats.set(row.chatId, chat);
  }
  return [...chats.values()].sort((first, second) => second.bytes - first.bytes);
}
