import type { ChatSummary } from '../api/client';

/**
 * Where tapping a notification leads (FL8). Pure: the notification's `data` —server push or local
 * notice— decides the screen.
 *
 * - `tipo: 'agenda'` (reminder or event) → the Agenda tab.
 * - a valid `chatId` → that chat and, when the notice carries them, the message (`seq`), the thread
 *   it belongs to (`hiloDe`, the `seq` of its root) and the space (`workspaceId`).
 *
 * The `data` comes from outside (FCM), so it is validated: a `chatId` shaped unlike a Mongo id is
 * never used to navigate, and an invalid number or space is dropped without losing the notice
 * (the chat opens, with no jump).
 */
export type NoticeDestination =
  | { tipo: 'chat'; chatId: string; seq?: number; hiloDe?: number; workspaceId?: string; daliTab?: DaliTab }
  | { tipo: 'agenda' };

/** Which tab of a Dali space the chat opens on (José 20/11, via agentes): empty outside a prospect channel. */
export type DaliTab = 'inbox' | 'chats';
const DALI_TABS: readonly DaliTab[] = ['inbox', 'chats'];

const MONGO_ID = /^[a-f0-9]{24}$/;
const POSITIVE_INTEGER = /^\d+$/;

/** A valid `seq` is an integer >= 1: `0` means «open the chat at its end» and empty means «not applicable». */
function positiveInteger(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && POSITIVE_INTEGER.test(value) ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) && number >= 1 ? number : undefined;
}

export function noticeDestination(data: unknown): NoticeDestination | null {
  if (!data || typeof data !== 'object') return null;
  const { chatId, tipo, seq, hiloDe, workspaceId, daliTab } = data as Record<string, unknown>;
  if (tipo === 'agenda') return { tipo: 'agenda' };
  if (typeof chatId !== 'string' || !MONGO_ID.test(chatId)) return null;
  const messageSeq = positiveInteger(seq);
  const rootSeq = positiveInteger(hiloDe);
  return {
    tipo: 'chat',
    chatId,
    ...(messageSeq !== undefined ? { seq: messageSeq } : {}),
    ...(rootSeq !== undefined ? { hiloDe: rootSeq } : {}),
    ...(typeof workspaceId === 'string' && MONGO_ID.test(workspaceId) ? { workspaceId } : {}),
    ...(typeof daliTab === 'string' && DALI_TABS.includes(daliTab as DaliTab) ? { daliTab: daliTab as DaliTab } : {}),
  };
}

/** Where the person lands when a chat is opened from outside: the message, the thread and the reply. */
export type EntryPoint = {
  /** Where the chat jumps: the message, or the root when it is a thread reply. */
  irASeq?: number;
  /** The root of the thread that opens over the chat. */
  openThread?: number;
  /** The thread reply that is highlighted. */
  highlightReply?: number;
};

/** What the app does with a tap, once it knows whether the chat exists. */
export type OpeningPlan =
  | { action: 'none' }
  | ({
      action: 'open';
      chat: ChatSummary;
      /** The space shown BEFORE navigating: the chat's own, or `null` for Personal. */
      space: string | null;
      /** Which Dali tab to switch to first, when the chat's space has one (José 20/11, via agentes). */
      daliTab?: DaliTab;
    } & EntryPoint);

/**
 * What to do with a tap. If the chat was not found (not mine, deleted, not in
 * the list) nothing is done: switching space blindly would leave the person in
 * another list with no chat to see.
 */
export function planOpening(destination: NoticeDestination | null, chat: ChatSummary | null): OpeningPlan {
  if (!destination || destination.tipo !== 'chat' || !chat) return { action: 'none' };
  const { seq, hiloDe, workspaceId, daliTab } = destination;
  const irASeq = hiloDe ?? seq;
  return {
    action: 'open',
    chat,
    space: workspaceId ?? null,
    ...(daliTab !== undefined ? { daliTab } : {}),
    ...(irASeq !== undefined ? { irASeq } : {}),
    ...(hiloDe !== undefined ? { openThread: hiloDe } : {}),
    ...(hiloDe !== undefined && seq !== undefined ? { highlightReply: seq } : {}),
  };
}
