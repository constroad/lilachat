import { Types } from 'mongoose';
import { resolveDeliveryState, TELEFONO_DE_LILA, type DeliveryState } from '@lilachat/shared';
import { ChatModel, MessageModel, ReceiptModel } from './chatModels.js';
import { UserModel } from './models.js';

export type MiembroDeInfo = { id: string; name: string | null; phone: string | null; estado: DeliveryState };

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
}): Promise<{ ok: true; miembros: MiembroDeInfo[] } | { ok: false; motivo: string }> {
  if (!Types.ObjectId.isValid(params.chatId) || !Number.isInteger(params.seq)) {
    return { ok: false, motivo: 'No encontramos ese mensaje.' };
  }
  const chatId = new Types.ObjectId(params.chatId);
  const [chat, mensaje] = await Promise.all([
    ChatModel.findOne({ _id: chatId, 'members.userId': params.quien }).select('members.userId').lean(),
    MessageModel.findOne({ chatId, seq: params.seq }).select('senderId').lean(),
  ]);
  if (!chat || !mensaje || String(mensaje.senderId) !== String(params.quien)) {
    return { ok: false, motivo: 'No encontramos ese mensaje.' };
  }

  const otros = chat.members.map((member) => member.userId).filter((id) => String(id) !== String(params.quien));
  const [personas, acuses] = await Promise.all([
    UserModel.find({ _id: { $in: otros } }).select('name phone').lean(),
    ReceiptModel.find({ chatId, userId: { $in: otros } }).select('userId readSeq deliveredSeq').lean(),
  ]);
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
      return {
        id: String(persona._id),
        name: persona.name ?? null,
        phone: persona.phone ?? null,
        estado: resolveDeliveryState({
          seq: params.seq,
          otherReadSeq: acuse?.readSeq ?? 0,
          otherDeliveredSeq: acuse?.deliveredSeq ?? 0,
        }),
      };
    });
  return { ok: true, miembros };
}
