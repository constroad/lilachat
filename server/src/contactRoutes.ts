import { Router } from 'express';
import { groupContactsByLetter, type Contact } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { InvitationModel, UserModel } from './models.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * Los contactos (F8.1, pedido de José: «¿por qué me pide conversaciones y no
 * contactos?»).
 *
 * **Contacto = alguien de la LISTA DE INVITADOS**, no «cualquier usuario». En
 * una app de mensajería, una lista de contactos que incluye a todo el mundo es
 * un directorio de teléfonos abierto — y acá el padrón ya existe: es la familia
 * que alguien invitó.
 */
export function buildContactRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', asyncRoute(async (req, res) => {
    const me = req.session!.userId;

    const invitados = await InvitationModel.find({ status: 'invited' }).select('phone').lean();
    const telefonos = invitados.map((invitacion) => invitacion.phone);

    const [usuarios, directos] = await Promise.all([
      UserModel.find({ phone: { $in: telefonos }, _id: { $ne: me } })
        .select('name phone')
        .lean(),
      // Con quién ya tengo un 1:1: la lista abre en vez de crear otro.
      ChatModel.find({ kind: 'direct', 'members.userId': me }).select('members').lean(),
    ]);

    const chatCon = new Map<string, string>();
    for (const chat of directos) {
      const otro = chat.members.find((member) => String(member.userId) !== String(me));
      if (otro) chatCon.set(String(otro.userId), String(chat._id));
    }

    const contacts: Contact[] = usuarios.map((usuario) => ({
      id: String(usuario._id),
      name: usuario.name ?? null,
      phone: usuario.phone,
      directChatId: chatCon.get(String(usuario._id)) ?? null,
    }));

    res.json({ groups: groupContactsByLetter(contacts) });
  }));

  return router;
}
