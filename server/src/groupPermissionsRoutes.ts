import { Router } from 'express';
import { Types } from 'mongoose';
import { memberPermissionsOf, memberPermissionsPatch, type MemberPermissions } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { asyncRoute, requireSession } from './requireSession.js';
import { avisarCambioDeChat } from './socket.js';

type Outcome = { ok: true; permissions: MemberPermissions; members: string[] } | { ok: false; status: 400 | 403; reason: string };

/** Only a group's admin changes what the rest may do; a 1:1 or a draft has no such switches. */
export async function setMemberPermissions(params: { chatId: string; who: Types.ObjectId; patch: unknown }): Promise<Outcome> {
  const patch = memberPermissionsPatch(params.patch);
  if (!patch) return { ok: false, status: 400, reason: 'No hay nada que cambiar.' };
  const chat = Types.ObjectId.isValid(params.chatId) ? await ChatModel.findOne({ _id: params.chatId, 'members.userId': params.who }).select('kind members memberPermissions').lean() : null;
  if (!chat || chat.kind !== 'group') return { ok: false, status: 400, reason: 'Esto solo se cambia en un grupo.' };
  const isAdmin = chat.members.some((member) => String(member.userId) === String(params.who) && member.role === 'admin');
  if (!isAdmin) return { ok: false, status: 403, reason: 'Solo los admins cambian los permisos del grupo.' };
  const permissions = { ...memberPermissionsOf(chat.memberPermissions), ...patch };
  await ChatModel.updateOne({ _id: chat._id }, { $set: { memberPermissions: permissions } });
  return { ok: true, permissions, members: chat.members.map((member) => String(member.userId)) };
}

/**
 * «Permisos del grupo» (pending 8, design `permisos-admin`), like WhatsApp's
 * group settings. Its own module: `chatRoutes` is already over 600 lines.
 */
export function buildGroupPermissionsRouter(): Router {
  const router = Router();
  router.patch('/chats/:chatId/permissions', requireSession, asyncRoute(async (req, res) => {
    const outcome = await setMemberPermissions({ chatId: req.params.chatId!, who: new Types.ObjectId(req.session!.userId), patch: req.body });
    if (!outcome.ok) return res.status(outcome.status).json({ message: outcome.reason });
    // Everyone's composer and buttons follow the switches at once.
    for (const id of outcome.members) avisarCambioDeChat(id, req.params.chatId!);
    return res.status(200).json({ ok: true, memberPermissions: outcome.permissions });
  }));
  return router;
}
