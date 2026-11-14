import { isPending, type Row } from './rowKinds';
import type { ChatMessage } from './useChat';

/** The row of a reply in the thread as it is NOW: a scroll that runs later never trusts an index it kept. */
export function replyRowOf(rows: readonly { seq?: number; pending?: boolean }[], seq: number | undefined): number {
  if (seq === undefined) return -1;
  return rows.findIndex((row) => row.pending !== true && row.seq === seq);
}

/** What the thread's photo viewer swipes through: the root, then the replies already sent (a pending one has no seq). */
export function threadPhotoMessages<Sent extends { seq: number; pending?: false }, Pending extends { pending: true }>(root: Sent | null, replies: readonly (Sent | Pending)[]): Sent[] {
  const sent = replies.filter((reply): reply is Sent => reply.pending !== true);
  return root ? [root, ...sent] : sent;
}

/** A reply with something to see or play: a photo, video, voice note or file (a sticker keeps its own drawing). */
export function isThreadMediaReply(row: Row): row is ChatMessage {
  return !isPending(row) && Boolean(row.media) && !row.deletedAt && row.kind !== 'sticker';
}
