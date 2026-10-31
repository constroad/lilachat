import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';

/**
 * «Confirmaciones de lectura», como WhatsApp (R31/10): whoever turns them off
 * stops telling «leído» in their 1:1s AND stops seeing the other's; both only
 * see «entregado». Groups and channels always tell it. Every way a read cursor
 * leaves the server goes through here: the live receipt, the chat list and the
 * message's info.
 */
export type ReceiptFrame = { readSeq?: number; deliveredSeq?: number } & Record<string, unknown>;

/** Whether any of these people turned read receipts off. */
export async function anyHidesRead(userIds: readonly (string | Types.ObjectId)[]): Promise<boolean> {
  if (userIds.length === 0) return false;
  return (await UserModel.exists({ _id: { $in: userIds }, readReceiptsOff: true })) !== null;
}

/** Who hears a receipt of this chat, and whether «leído» stays hidden there. */
export async function receiptAudience(chatId: string): Promise<{ members: string[]; hideRead: boolean }> {
  if (!Types.ObjectId.isValid(chatId)) return { members: [], hideRead: false };
  const chat = await ChatModel.findById(chatId).select('kind members.userId').lean();
  const members = (chat?.members ?? []).map((member) => String(member.userId));
  if (chat?.kind !== 'direct') return { members, hideRead: false };
  return { members, hideRead: await anyHidesRead(members) };
}

/** The receipt a member gets: the reader's own devices keep it whole; with «leído» hidden the others learn only «delivered» (reading implies it). */
export function receiptFor(member: string, reader: string, frame: ReceiptFrame, hideRead: boolean): ReceiptFrame {
  if (!hideRead || member === reader || frame.readSeq === undefined) return frame;
  const { readSeq, ...rest } = frame;
  return { ...rest, deliveredSeq: Math.max(rest.deliveredSeq ?? 0, readSeq) };
}

/** Sends a read receipt to everyone in the chat, each with what they may know. */
export async function broadcastReceipt(chatId: string, reader: string, frame: ReceiptFrame, emit: (member: string, frame: ReceiptFrame) => void): Promise<void> {
  const audience = await receiptAudience(chatId);
  for (const member of audience.members) emit(member, receiptFor(member, reader, frame, audience.hideRead));
}
