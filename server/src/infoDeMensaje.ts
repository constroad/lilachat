import { Types } from 'mongoose';
import { resolveDeliveryState, TELEFONO_DE_LILA, type DeliveryState } from '@lilachat/shared';
import { ChatModel, MessageModel, ReceiptModel } from './chatModels.js';
import { UserModel } from './models.js';
import { timeOfSeq } from './acusesDelChat.js';
import { anyHidesRead } from './readPrivacy.js';
import { hiddenInChat, hiddenMembersOf } from './hiddenMembers.js';

export type MiembroDeInfo = { id: string; name: string | null; phone: string | null; estado: DeliveryState };
/** José 13/11: when the message was read and got there, like WhatsApp. */
export type InfoMember = MiembroDeInfo & { readAt?: string; deliveredAt?: string };

/**
 * «Info» de un mensaje propio (FL9), como WhatsApp: el estado del mensaje para
 * cada miembro —leído, entregado o solo enviado—. Los acuses son un CURSOR por
 * persona («leí hasta el 42»), así que se sabe el estado y no la hora. Sin mí
 * y sin Lila, que no cuenta para los checks.
 */
export async function infoDeMensaje(params: {
  chatId: string;
  seq: number;
  quien: Types.ObjectId;
}): Promise<{ ok: true; miembros: InfoMember[] } | { ok: false; motivo: string }> {
  if (!Types.ObjectId.isValid(params.chatId) || !Number.isInteger(params.seq)) {
    return { ok: false, motivo: 'No encontramos ese mensaje.' };
  }
  const chatId = new Types.ObjectId(params.chatId);
  const [chat, mensaje] = await Promise.all([
    ChatModel.findOne({ _id: chatId, 'members.userId': params.quien }).select('kind workspaceId members.userId').lean(),
    MessageModel.findOne({ chatId, seq: params.seq }).select('senderId').lean(),
  ]);
  if (!chat || !mensaje || String(mensaje.senderId) !== String(params.quien)) {
    return { ok: false, motivo: 'No encontramos ese mensaje.' };
  }

  // A hidden member of the space is not told among who read it (`hiddenMembers.ts`).
  const hidden = hiddenInChat(await hiddenMembersOf(chat.kind === 'direct' ? [] : [chat.workspaceId]), chat, String(params.quien));
  const otros = chat.members.map((member) => member.userId).filter((id) => String(id) !== String(params.quien) && !hidden.has(String(id)));
  const [personas, acuses] = await Promise.all([
    UserModel.find({ _id: { $in: otros } }).select('name phone').lean(),
    ReceiptModel.find({ chatId, userId: { $in: otros } }).select('userId readSeq deliveredSeq readLog deliveredLog').lean(),
  ]);
  // R31/10: with read receipts off in a 1:1 (either side), «leído» is not told; «entregado» is.
  const hideRead = chat.kind === 'direct' && (await anyHidesRead(chat.members.map((member) => member.userId)));
  const acusePorId = new Map(acuses.map((acuse) => [String(acuse.userId), acuse]));
  const personaPorId = new Map(personas.map((persona) => [String(persona._id), persona]));
  // En el orden de los miembros del chat: el `find` no garantiza ninguno.
  const miembros = otros
    .flatMap((id) => {
      const persona = personaPorId.get(String(id));
      return persona && persona.phone !== TELEFONO_DE_LILA ? [persona] : [];
    })
    .map((persona) => {
      const acuse = acusePorId.get(String(persona._id));
      const state = resolveDeliveryState({
        seq: params.seq,
        otherReadSeq: hideRead ? 0 : (acuse?.readSeq ?? 0),
        otherDeliveredSeq: acuse?.deliveredSeq ?? 0,
      });
      // José 13/11: the time, like WhatsApp; reading implies delivery.
      const readAt = state === 'read' ? timeOfSeq(acuse?.readLog, params.seq) : undefined;
      const deliveredAt = state === 'read' || state === 'delivered' ? (timeOfSeq(acuse?.deliveredLog, params.seq) ?? readAt) : undefined;
      return {
        id: String(persona._id),
        name: persona.name ?? null,
        phone: persona.phone ?? null,
        estado: state,
        ...(readAt ? { readAt: readAt.toISOString() } : {}),
        ...(deliveredAt ? { deliveredAt: deliveredAt.toISOString() } : {}),
      };
    });
  return { ok: true, miembros };
}
