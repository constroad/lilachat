import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { escribirAviso } from './chatService.js';
import { InvitationModel, UserModel } from './models.js';
import { avisarCambioDeChat, publicarMensaje } from './reparto.js';

/**
 * «Aracely se unió a Lilachat» (José, 21/10, like Telegram): when someone I
 * invited creates their account, a notice from them lands in our 1:1 (created
 * if we had none), live or by push, so I can greet them. Only to who invited
 * them: the server keeps no address books, by design. Once per account, only
 * for accounts created now (`joinPending`, set on insert), and only when they
 * already have a name: «Alguien se unió» says nothing.
 */
async function directChat(a: Types.ObjectId, b: Types.ObjectId): Promise<Types.ObjectId> {
  const existing = await ChatModel.findOne({ kind: 'direct', workspaceId: { $exists: false }, 'members.userId': { $all: [a, b] }, members: { $size: 2 } }).select('_id').lean();
  if (existing) return existing._id;
  const created = await ChatModel.create({ kind: 'direct', members: [{ userId: a, role: 'member' }, { userId: b, role: 'member' }], lastSeq: 0 });
  return created._id;
}

async function inviterIds(phone: string, userId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const invitations = await InvitationModel.find({ phone, status: 'invited' }).select('invitedBy').lean();
  const ids = invitations.map((invitation) => invitation.invitedBy).filter((id) => Types.ObjectId.isValid(id) && id !== String(userId));
  return [...new Set(ids)].map((id) => new Types.ObjectId(id));
}

export async function announceJoin(userId: Types.ObjectId): Promise<number> {
  // Taken once: whoever clears the mark announces; a second call finds nothing pending.
  const user = await UserModel.findOneAndUpdate({ _id: userId, joinPending: true, name: { $exists: true, $ne: '' } }, { $unset: { joinPending: 1 } }).select('_id name phone').lean();
  if (!user) return 0;
  const inviters = await inviterIds(user.phone, user._id);
  for (const inviter of inviters) {
    if (!(await UserModel.exists({ _id: inviter }))) continue;
    const chatId = await directChat(inviter, user._id);
    const notice = await escribirAviso({ chatId: String(chatId), quien: user._id, evento: 'se-unio', body: `${user.name} se unió a Lilachat`, quien2: { name: user.name, phone: user.phone } });
    if (!notice) continue;
    await publicarMensaje(notice, [String(inviter), String(user._id)]);
    avisarCambioDeChat(String(inviter), String(chatId));
  }
  return inviters.length;
}
