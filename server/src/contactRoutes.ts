import { Router } from 'express';
import {
  groupContactsByLetter,
  limpiarNumerosParaEmparejar,
  validarInvitacion,
  type Contact,
} from '@lilachat/shared';
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

  /**
   * Invitar a alguien: crear su ADMISIÓN.
   *
   * Sin esto, `POST /auth/otp/request` no le manda nada —y contesta 200 igual,
   * para no revelar quién existe—, así que la persona instala la app y no puede
   * entrar nunca. Le pasó a Wilson el 26/08/2026: el botón «Invitar» compartía
   * el enlace de descarga y no daba de alta a nadie.
   *
   * **Solo desde una sesión.** Un endpoint abierto que crea admisiones convierte
   * el chat familiar en un registro público: cualquiera se auto-invitaría.
   *
   * Es idempotente: invitar dos veces al mismo número no crea dos filas ni
   * revive una revocada por error — `status` se fija explícitamente.
   */
  router.post('/invite', asyncRoute(async (req, res) => {
    const yo = await UserModel.findById(req.session!.userId).select('phone').lean();

    const validada = validarInvitacion({
      telefono: String(req.body?.phone ?? ''),
      yoSoy: yo?.phone ?? '',
    });
    if (!validada.ok) return res.status(400).json({ message: validada.motivo });

    // Ya es usuario: no hace falta admitirlo y decirlo no filtra nada que quien
    // invita no pueda ver igual en sus contactos.
    const yaEs = await UserModel.findOne({ phone: validada.phone }).select('_id').lean();
    if (yaEs) return res.status(200).json({ estado: 'ya-esta' });

    await InvitationModel.updateOne(
      { phone: validada.phone },
      {
        $set: { status: 'invited', invitedBy: String(req.session!.userId) },
        $setOnInsert: { phone: validada.phone },
      },
      { upsert: true }
    );

    res.status(201).json({ estado: 'invitado' });
  }));

  /**
   * ¿Cuáles de MIS contactos están en Lilachat? — el modelo de WhatsApp.
   *
   * El teléfono manda los números que YA tiene guardados y el server contesta
   * cuáles coinciden. La dirección de la pregunta es el diseño: nadie puede
   * descubrir un número que no tuviera antes, y por eso el padrón nunca se
   * devuelve entero.
   *
   * **No se guarda nada de lo que llega.** Los números se usan para la consulta
   * y se descartan; el server ya conoce los de sus propios usuarios y no le
   * interesa saber a quién más tiene alguien en la agenda.
   *
   * El nombre que se devuelve es el que la persona puso en Lilachat; la app
   * muestra el de SU agenda, que es el que quien mira reconoce.
   */
  router.post('/match', asyncRoute(async (req, res) => {
    const me = req.session!.userId;
    const numeros = limpiarNumerosParaEmparejar(req.body?.phones);
    if (numeros.length === 0) return res.json({ contacts: [] });

    const [usuarios, directos] = await Promise.all([
      UserModel.find({ phone: { $in: numeros }, _id: { $ne: me } })
        .select('name phone')
        .lean(),
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

    res.json({ contacts, groups: groupContactsByLetter(contacts) });
  }));

  router.get('/', asyncRoute(async (req, res) => {
    const me = req.session!.userId;

    /**
     * **El padrón NO se devuelve.** Esta lista es solo con quién YA tengo una
     * conversación.
     *
     * Devolver todos los usuarios duró unas horas y fue un error: con el
     * registro abierto, cualquiera que entrara veía el teléfono de toda la
     * familia. Descubrir a quién más está registrado se hace por
     * `POST /match`, preguntando por los números que uno YA tiene en su agenda
     * — así nadie se entera de un número que no tuviera antes.
     */
    const directos = await ChatModel.find({ kind: 'direct', 'members.userId': me })
      .select('members')
      .lean();

    const idsConChat = directos
      .map((chat) => chat.members.find((member) => String(member.userId) !== String(me))?.userId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));

    const usuarios = await UserModel.find({ _id: { $in: idsConChat } })
      .select('name phone')
      .lean();
    {
      // Con quién ya tengo un 1:1: la lista abre en vez de crear otro.
    }

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
