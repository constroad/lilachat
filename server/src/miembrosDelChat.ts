import { Types } from 'mongoose';
import {
  decidirSalida,
  memberMay,
  memberPermissionDenied,
  normalizeChannelName,
  normalizarDescripcion,
  normalizarNombreDeGrupo,
  puedeAgregar,
  puedeCambiarRol,
  puedeEditarInfo,
  puedeSacar,
  settingsForLevel,
  type ChannelVisibility,
  type MemberPermission,
  type NotificationLevel,
} from '@lilachat/shared';
import { UserModel } from './models.js';
import { ChatModel, ReceiptModel, type Chat } from './chatModels.js';
import { addBotsToPublicChannel } from './bots/botInstall.js';
import { BotInstallationModel } from './bots/botModels.js';
import { GENERAL_CHANNEL } from './workspaceGeneral.js';
import { allActiveIn } from './workspaceChats.js';

/**
 * Quién está en un chat y cómo: sumar, sacar, cambiar el rol, salir, el nombre
 * y la foto del grupo, y los ajustes de cada miembro (silenciar, fijar,
 * archivar, no leído). Salió de `chatService.ts`, que pasaba de 900 líneas.
 */
/**
 * Sumar a alguien a un grupo.
 *
 * El permiso se decide en `shared/miembrosDeGrupo.ts` y se comprueba ACÁ: la app
 * solo evita el viaje, no protege — un cliente modificado se saltea cualquier
 * validación del teléfono.
 */
export type AddMemberResult = { ok: true; chat: Chat } | { ok: false; motivo: string; status?: 403 };

const forbidden = (motivo: string): AddMemberResult => ({ ok: false, motivo, status: 403 });

/** Pending 8: what the group's admins let the rest do; a draft or a 1:1 has no such switches. */
function mayInGroup(chat: Chat, who: Types.ObjectId, permission: MemberPermission): boolean {
  if (chat.kind !== 'group') return true;
  const role = chat.members.find((member) => String(member.userId) === String(who))?.role;
  return memberMay({ permission, role: role === 'admin' ? 'admin' : 'member', permissions: chat.memberPermissions });
}

/**
 * Who may be added to a chat of a space: its active members, or an app installed there
 * (an app comes back to a channel this way after an admin took it out, pending 91).
 */
async function mayJoinSpaceChat(spaceId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
  if (await allActiveIn(spaceId, [userId])) return true;
  return Boolean(await BotInstallationModel.exists({ workspaceId: spaceId, botUserId: userId, revokedAt: { $exists: false } }));
}

export async function addMember(params: {
  chatId: string;
  quien: Types.ObjectId;
  aQuien: string;
}): Promise<AddMemberResult> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  // In a space, only a member of this chat who is still active in the space lets people in (Agentes, 25/10/2026).
  if (chat.workspaceId) {
    const inChat = chat.members.some((member) => String(member.userId) === String(params.quien));
    if (!inChat || !(await allActiveIn(chat.workspaceId, [params.quien]))) return forbidden('Solo quien está en este canal y sigue activo en el espacio puede agregar gente.');
  }

  const decision = puedeAgregar({
    quien: String(params.quien),
    aQuien: params.aQuien,
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (!decision.ok) return { ok: false, motivo: decision.motivo };
  if (!mayInGroup(chat, params.quien, 'addMembers')) return forbidden(memberPermissionDenied('addMembers'));

  // Que la persona EXISTA se comprueba acá y no en el motor: es un dato de la
  // base, no una regla. Sumar un id inventado dejaría un miembro fantasma que
  // aparece en la lista y no es nadie.
  const persona = await UserModel.findById(params.aQuien).select('_id').lean();
  if (!persona) return { ok: false, motivo: 'No encontramos a esa persona.' };
  if (chat.workspaceId && !(await mayJoinSpaceChat(chat.workspaceId, persona._id))) return forbidden('Esa persona no es miembro activo del espacio.');

  const actualizado = await ChatModel.findOneAndUpdate(
    // `$ne` en la condición y no solo `$addToSet`: así dos toques simultáneos no
    // pueden dejar a la misma persona dos veces en la lista.
    { _id: params.chatId, 'members.userId': { $ne: persona._id } },
    // An app taken out by an admin (pending 91) comes back only like this: someone adds it.
    { $push: { members: { userId: persona._id, role: 'member', joinedAt: new Date() } }, $pull: { appsRemoved: persona._id } },
    { returnDocument: 'after' }
  ).lean<Chat | null>();

  if (!actualizado) return { ok: false, motivo: 'Esa persona ya está en el grupo.' };
  // Lo de antes de entrar no lo frena (auditoría 19/10): sin acuse contaba como
  // 0 y, en un grupo, manda el menor — todos los checks bajaban a uno.
  const hasta = actualizado.lastSeq ?? 0;
  await ReceiptModel.updateOne({ chatId: actualizado._id, userId: persona._id }, { $max: { readSeq: hasta, deliveredSeq: hasta } }, { upsert: true });
  return { ok: true, chat: actualizado };
}

/** Los ajustes que cada miembro cambia para sí (el subdoc de `members`). */
export const AJUSTES_DE_MIEMBRO = ['muted', 'pinned', 'archived', 'markedUnread'] as const;

/**
 * Cambiar los ajustes de ESTE usuario en un chat: silenciar, fijar, archivar y
 * marcar como no leído (FL9).
 *
 * Son por-usuario y por-chat, así que viven en el subdoc del miembro, no en el
 * chat: que José silencie «Los originales» no lo silencia para Wilson. Se
 * actualiza SOLO la fila del usuario con el operador posicional `$`.
 */
export async function cambiarAjustesDeChat(params: {
  chatId: string;
  quien: Types.ObjectId;
  muted?: boolean;
  pinned?: boolean;
  archived?: boolean;
  markedUnread?: boolean;
  /** E3b: «todo», «menciones» or «nada»; it is written as `muted` + `avisos`. */
  avisos?: NotificationLevel;
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const cambios: Record<string, boolean | string> = {};
  for (const campo of AJUSTES_DE_MIEMBRO) {
    const valor = params[campo];
    if (typeof valor === 'boolean') cambios[`members.$.${campo}`] = valor;
  }
  const level = params.avisos ? settingsForLevel(params.avisos) : null;
  if (level) cambios['members.$.muted'] = level.muted;
  if (level?.avisos) cambios['members.$.avisos'] = level.avisos;
  if (Object.keys(cambios).length === 0) return { ok: false, motivo: 'No hay nada que cambiar.' };
  // Unmuting (from any client) or choosing a level without «nada» clears it.
  const clearNothing = (level && !level.avisos) || params.muted === false;

  const r = await ChatModel.updateOne(
    { _id: params.chatId, 'members.userId': params.quien },
    { $set: cambios, ...(clearNothing ? { $unset: { 'members.$.avisos': 1 } } : {}) }
  );
  if (r.matchedCount === 0) return { ok: false, motivo: 'No estás en esa conversación.' };
  return { ok: true };
}

/**
 * Sacar a alguien del grupo.
 *
 * Las reglas están en `puedeSacar` (motor puro): solo un admin, nunca a otro
 * admin, y a uno mismo tampoco —para eso está salir—.
 *
 * Devuelve los miembros de ANTES del cambio porque el aviso hay que mandárselo
 * también al que se sacó: si se notifica solo a los que quedan, el grupo le
 * sigue apareciendo en la lista hasta que reabra la app, y sigue viéndolo en un
 * chat donde ya no puede escribir.
 */
export async function removeMember(params: {
  chatId: string;
  quien: Types.ObjectId;
  aQuien: string;
}): Promise<{ ok: true; miembrosPrevios: string[] } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const decision = puedeSacar({
    quien: String(params.quien),
    aQuien: params.aQuien,
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (!decision.ok) return { ok: false, motivo: decision.motivo };

  const victima = new Types.ObjectId(params.aQuien);
  // La membresía va en la CONDICIÓN: si entre la lectura y el update la persona
  // ya salió sola, esto no modifica nada y se dice, en vez de contestar que se
  // hizo algo que no pasó.
  // An app taken out stays out (pending 91): it does not rejoin a public channel on its next message.
  const esApp = await UserModel.exists({ _id: victima, app: { $exists: true } });
  const resultado = await ChatModel.updateOne(
    { _id: params.chatId, 'members.userId': victima },
    { $pull: { members: { userId: victima } }, ...(esApp ? { $addToSet: { appsRemoved: victima } } : {}) }
  );
  if (resultado.matchedCount === 0) {
    return { ok: false, motivo: 'Esa persona ya no está en el grupo.' };
  }

  return { ok: true, miembrosPrevios: chat.members.map((m) => String(m.userId)) };
}

/**
 * Nombrar admin, o dejar de serlo.
 *
 * Las reglas están en `puedeCambiarRol`: nombrar lo puede hacer cualquier admin,
 * pero el admin se lo saca uno mismo —nadie se lo saca a otro— y el único admin
 * no puede renunciar sin nombrar reemplazo.
 */
export async function changeRole(params: {
  chatId: string;
  quien: Types.ObjectId;
  aQuien: string;
  rol: 'admin' | 'member';
}): Promise<{ ok: true; miembros: string[] } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const decision = puedeCambiarRol({
    quien: String(params.quien),
    aQuien: params.aQuien,
    rol: params.rol,
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (!decision.ok) return { ok: false, motivo: decision.motivo };

  // El rol ANTERIOR va en la condición: si entre la lectura y el update alguien
  // más lo cambió, esto no pisa esa decisión con una vista vieja.
  const anterior = params.rol === 'admin' ? 'member' : 'admin';
  const resultado = await ChatModel.updateOne(
    {
      _id: params.chatId,
      members: {
        $elemMatch: {
          userId: new Types.ObjectId(params.aQuien),
          // Los miembros viejos no tienen `role` guardado: ausente = «member».
          ...(anterior === 'member'
            ? { $or: [{ role: 'member' }, { role: { $exists: false } }] }
            : { role: 'admin' }),
        },
      },
    },
    { $set: { 'members.$.role': params.rol } }
  );
  if (resultado.matchedCount === 0) {
    return { ok: false, motivo: 'Alguien cambió eso mientras mirabas. Prueba de nuevo.' };
  }

  return { ok: true, miembros: chat.members.map((m) => String(m.userId)) };
}

/**
 * Cambiar el nombre del grupo, o su foto.
 *
 * **Lo puede cualquier miembro** (`puedeEditarInfo`): es la misma regla que
 * sumar gente. Lo que pide admin es lo que le SACA algo a otro.
 *
 * Las dos cosas pasan por acá porque comparten el permiso y el aviso; lo que
 * cambia es el campo. Devuelve a quién avisarle: el nombre y la foto se ven en
 * la lista de TODOS, no solo de quien los cambió.
 */
export async function editarInfoDeGrupo(params: {
  chatId: string;
  quien: Types.ObjectId;
  nombre?: unknown;
  avatar?: { url: string; mediaId: string };
  descripcion?: unknown;
  /** A channel's `public` or `private` (pending 93): only its admins. */
  visibility?: unknown;
}): Promise<{ ok: true; miembros: string[]; nombre?: string; descripcion?: string; visibilidad?: ChannelVisibility } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  const decision = puedeEditarInfo({
    quien: String(params.quien),
    // Un borrador también tiene nombre y foto propios (19/10).
    esGrupo: chat.kind !== 'direct',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (!decision.ok) return { ok: false, motivo: decision.motivo };
  if (!mayInGroup(chat, params.quien, 'editInfo')) return { ok: false, motivo: memberPermissionDenied('editInfo') };

  const cambios: Record<string, unknown> = {};
  let nombreNuevo: string | undefined;

  if (params.nombre !== undefined) {
    if (chat.propio) return { ok: false, motivo: 'Tu chat contigo siempre se llama «Tú».' };
    const validado = chat.channel ? await channelNameFor(chat, params.nombre) : normalizarNombreDeGrupo(params.nombre);
    if (!validado.ok) return { ok: false, motivo: validado.motivo };
    nombreNuevo = validado.nombre;
    cambios.name = validado.nombre;
  }
  let visibilidad: ChannelVisibility | undefined;
  if (params.visibility !== undefined) {
    const decided = channelVisibilityFor(chat, String(params.quien), params.visibility);
    if (!decided.ok) return { ok: false, motivo: decided.motivo };
    if (decided.visibility !== chat.channel!.visibility) {
      visibilidad = decided.visibility;
      cambios['channel.visibility'] = decided.visibility;
    }
  }
  if (params.avatar) {
    cambios.avatarUrl = params.avatar.url;
    cambios.avatarMediaId = params.avatar.mediaId;
  }
  let descripcionNueva: string | undefined;
  const sacar: Record<string, 1> = {};
  if (params.descripcion !== undefined) {
    const validada = normalizarDescripcion(params.descripcion);
    if (!validada.ok) return { ok: false, motivo: validada.motivo };
    descripcionNueva = validada.descripcion;
    // Vacía = borrarla: un campo que no está, no uno vacío.
    if (validada.descripcion) cambios.descripcion = validada.descripcion;
    else sacar.descripcion = 1;
  }
  if (Object.keys(cambios).length === 0 && Object.keys(sacar).length === 0) {
    return { ok: false, motivo: 'No hay nada que cambiar.' };
  }

  await ChatModel.updateOne({ _id: params.chatId }, { ...(Object.keys(cambios).length ? { $set: cambios } : {}), ...(Object.keys(sacar).length ? { $unset: sacar } : {}) });
  // A channel made public lets the space's apps in, as one created public does.
  if (visibilidad === 'public' && chat.workspaceId) await addBotsToPublicChannel(chat.workspaceId, chat._id);
  return { ok: true, miembros: chat.members.map((m) => String(m.userId)), nombre: nombreNuevo, descripcion: descripcionNueva, ...(visibilidad ? { visibilidad } : {}) };
}

/** A channel keeps a channel's name (#obra-norte), unique in its space; #general is everyone's and keeps its name. */
async function channelNameFor(chat: Chat, raw: unknown): Promise<{ ok: true; nombre: string } | { ok: false; motivo: string }> {
  const name = typeof raw === 'string' ? normalizeChannelName(raw) : null;
  if (!name) return { ok: false, motivo: 'Ponle un nombre al canal (letras y números).' };
  if (chat.name === GENERAL_CHANNEL && name !== GENERAL_CHANNEL) return { ok: false, motivo: 'El canal #general no se renombra: es el de todo el espacio.' };
  if (await ChatModel.exists({ _id: { $ne: chat._id }, workspaceId: chat.workspaceId, 'channel.visibility': { $exists: true }, name })) return { ok: false, motivo: `Ya hay un canal #${name} en el espacio.` };
  return { ok: true, nombre: name };
}

/** Who finds a channel: only its admins decide, and #general is always public. */
function channelVisibilityFor(chat: Chat, quien: string, raw: unknown): { ok: true; visibility: ChannelVisibility } | { ok: false; motivo: string } {
  if (!chat.channel) return { ok: false, motivo: 'Solo un canal es público o privado.' };
  if (raw !== 'public' && raw !== 'private') return { ok: false, motivo: 'La visibilidad va como public o private.' };
  if (!chat.members.some((member) => String(member.userId) === quien && member.role === 'admin')) return { ok: false, motivo: 'Solo los admins del canal cambian quién lo encuentra.' };
  if (chat.name === GENERAL_CHANNEL && raw === 'private') return { ok: false, motivo: 'El canal #general es de todo el espacio: no se hace privado.' };
  return { ok: true, visibility: raw };
}

/**
 * Salir de un grupo.
 *
 * **Si se va el último admin se promueve al miembro más antiguo**, en la misma
 * operación. Sin eso queda un grupo que nadie puede administrar nunca más, y eso
 * solo se arregla desde la base.
 */
export async function leaveChat(params: {
  chatId: string;
  quien: Types.ObjectId;
}): Promise<
  | { ok: true; miembrosRestantes: string[]; nuevoAdmin: string | null }
  | { ok: false; motivo: string }
> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

  // El orden de `members` ES la antigüedad: se agregan al final.
  const decision = decidirSalida({
    quien: String(params.quien),
    esGrupo: chat.kind === 'group',
    miembros: chat.members.map((m) => ({
      userId: String(m.userId),
      role: (m.role ?? 'member') as 'admin' | 'member',
    })),
  });
  if (decision.accion === 'imposible') return { ok: false, motivo: decision.motivo };

  await ChatModel.updateOne(
    { _id: params.chatId },
    { $pull: { members: { userId: params.quien } } }
  );

  if (decision.accion === 'salir' && decision.nuevoAdmin) {
    await ChatModel.updateOne(
      { _id: params.chatId, 'members.userId': new Types.ObjectId(decision.nuevoAdmin) },
      { $set: { 'members.$.role': 'admin' } }
    );
  }

  const quedan = chat.members
    .map((m) => String(m.userId))
    .filter((id) => id !== String(params.quien));
  return {
    ok: true,
    miembrosRestantes: quedan,
    // A quién promovió, para poder avisarlo en el chat: la promoción es una
    // decisión del server y sin contarla el grupo cambia de admin en silencio.
    nuevoAdmin: decision.accion === 'salir' ? decision.nuevoAdmin : null,
  };
}

/**
 * «Eliminar chat» para MÍ (FL9d), como WhatsApp: sale de mi lista y no veo
 * nada hasta el último mensaje de ahora; si alguien escribe, el chat vuelve
 * solo con lo nuevo. Al resto no le cambia nada. Queda leído hasta ahí, para
 * que al volver cuente solo lo nuevo como no leído.
 */
export async function borrarChatParaMi(params: {
  chatId: string;
  quien: Types.ObjectId;
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!Types.ObjectId.isValid(params.chatId)) return { ok: false, motivo: 'No encontramos esa conversación.' };
  const chat = await ChatModel.findOne({ _id: params.chatId, 'members.userId': params.quien })
    .select('lastSeq')
    .lean<{ _id: Types.ObjectId; lastSeq?: number } | null>();
  if (!chat) return { ok: false, motivo: 'No estás en esa conversación.' };
  const hasta = chat.lastSeq ?? 0;
  await Promise.all([
    ChatModel.updateOne(
      { _id: chat._id, 'members.userId': params.quien },
      { $set: { 'members.$.borradoHasta': hasta, 'members.$.markedUnread': false } }
    ),
    ReceiptModel.updateOne(
      { chatId: chat._id, userId: params.quien },
      { $max: { readSeq: hasta, deliveredSeq: hasta } },
      { upsert: true }
    ),
  ]);
  return { ok: true };
}
