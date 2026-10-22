import { Types } from 'mongoose';
import { notificationLevel } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { UserModel } from './models.js';
import { toAbsoluteMediaUrl } from './mediaClient.js';
import { WorkspaceMemberModel } from './workspaceModels.js';

/**
 * El detalle de una conversación: quiénes están y con qué rol (`GET
 * /api/chats/:chatId/detail`).
 *
 * Existe para la pantalla «Chat Detail» del diseño
 * (`design/stitch/info-grupo-alpha.png`). `GET /api/chats` da los `memberIds`
 * pero no los nombres, así que la pantalla no tenía con qué dibujar la lista.
 *
 * **Devuelve el teléfono de cada miembro** por el mismo motivo que el resumen
 * del chat: el server solo conoce el nombre que cada uno se puso, y el que
 * importa —el de TU agenda— solo lo puede resolver el teléfono. No filtra nada
 * nuevo: son las personas con las que ya compartís una conversación.
 */
export async function chatDetail(chatId: string, userId: Types.ObjectId) {
  // La membresía primero: sin esto se podría sondear la existencia de chats
  // ajenos por la diferencia entre «no existe» y «no permitido».
  if (!Types.ObjectId.isValid(chatId)) return null;
  const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': userId }).lean();
  if (!chat) return null;
  const ids = chat.members.map((m) => m.userId);
  const personas = await UserModel.find({ _id: { $in: ids } })
    .select('name phone avatarUrl')
    .lean<{ _id: unknown; name?: string; phone: string; avatarUrl?: string }[]>();
  const porId = new Map(personas.map((persona) => [String(persona._id), persona]));
  // In a company space the pill says the job title and the space role (design s-01), not the chat's.
  const enElEspacio = chat.workspaceId ? await WorkspaceMemberModel.find({ workspaceId: chat.workspaceId, userId: { $in: ids } }).select('userId title role').lean() : [];
  const cargos = new Map(enElEspacio.map((member) => [String(member.userId), member]));
  // En un 1:1 la foto ES la del perfil del otro (FL9), igual que en la lista.
  const otro = chat.kind === 'direct' ? personas.find((persona) => String(persona._id) !== String(userId)) : undefined;
  const foto = chat.avatarUrl ?? otro?.avatarUrl;
  return {
    id: String(chat._id),
    kind: chat.kind,
    name: chat.name,
    descripcion: chat.descripcion,
    funAllowed: chat.funAllowed === true,
    encrypted: chat.encrypted === true,
    // MI silenciado (es por persona): el interruptor del detalle lo muestra
    // como está, en vez de arrancar siempre apagado.
    muted: chat.members.some((m) => String(m.userId) === String(userId) && m.muted === true),
    avisos: notificationLevel(chat.members.find((m) => String(m.userId) === String(userId)) ?? {}),
    avatarUrl: foto ? toAbsoluteMediaUrl(foto) : undefined,
    members: chat.members.map((m) => {
      const persona = porId.get(String(m.userId));
      return {
        id: String(m.userId),
        name: persona?.name ?? null,
        phone: persona?.phone ?? null,
        // La foto de cada uno (FL13d): el detalle y las burbujas del grupo.
        avatarUrl: persona?.avatarUrl ? toAbsoluteMediaUrl(persona.avatarUrl) : undefined,
        role: m.role ?? 'member',
        esYo: String(m.userId) === String(userId),
        ...(cargos.has(String(m.userId)) ? { spaceRole: cargos.get(String(m.userId))!.role, ...(cargos.get(String(m.userId))!.title ? { title: cargos.get(String(m.userId))!.title } : {}) } : {}),
      };
    }),
  };
}
