import { Types } from 'mongoose';
import {
  decidirSalida,
  normalizarNombreDeGrupo,
  puedeAgregar,
  puedeCambiarRol,
  puedeEditarInfo,
  puedeSacar,
} from '@lilachat/shared';
import { UserModel } from './models.js';
import { ChatModel, ReceiptModel, type Chat } from './chatModels.js';

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
export async function addMember(params: {
  chatId: string;
  quien: Types.ObjectId;
  aQuien: string;
}): Promise<{ ok: true; chat: Chat } | { ok: false; motivo: string }> {
  const chat = await ChatModel.findOne({ _id: params.chatId }).lean<Chat | null>();
  if (!chat) return { ok: false, motivo: 'No encontramos esa conversación.' };

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

  // Que la persona EXISTA se comprueba acá y no en el motor: es un dato de la
  // base, no una regla. Sumar un id inventado dejaría un miembro fantasma que
  // aparece en la lista y no es nadie.
  const persona = await UserModel.findById(params.aQuien).select('_id').lean();
  if (!persona) return { ok: false, motivo: 'No encontramos a esa persona.' };

  const actualizado = await ChatModel.findOneAndUpdate(
    // `$ne` en la condición y no solo `$addToSet`: así dos toques simultáneos no
    // pueden dejar a la misma persona dos veces en la lista.
    { _id: params.chatId, 'members.userId': { $ne: persona._id } },
    { $push: { members: { userId: persona._id, role: 'member', joinedAt: new Date() } } },
    { returnDocument: 'after' }
  ).lean<Chat | null>();

  return actualizado
    ? { ok: true, chat: actualizado }
    : { ok: false, motivo: 'Esa persona ya está en el grupo.' };
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
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const cambios: Record<string, boolean> = {};
  for (const campo of AJUSTES_DE_MIEMBRO) {
    const valor = params[campo];
    if (typeof valor === 'boolean') cambios[`members.$.${campo}`] = valor;
  }
  if (Object.keys(cambios).length === 0) return { ok: false, motivo: 'No hay nada que cambiar.' };

  const r = await ChatModel.updateOne(
    { _id: params.chatId, 'members.userId': params.quien },
    { $set: cambios }
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
  const resultado = await ChatModel.updateOne(
    { _id: params.chatId, 'members.userId': victima },
    { $pull: { members: { userId: victima } } }
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
}): Promise<{ ok: true; miembros: string[]; nombre?: string } | { ok: false; motivo: string }> {
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

  const cambios: Record<string, unknown> = {};
  let nombreNuevo: string | undefined;

  if (params.nombre !== undefined) {
    const validado = normalizarNombreDeGrupo(params.nombre);
    if (!validado.ok) return { ok: false, motivo: validado.motivo };
    nombreNuevo = validado.nombre;
    cambios.name = validado.nombre;
  }
  if (params.avatar) {
    cambios.avatarUrl = params.avatar.url;
    cambios.avatarMediaId = params.avatar.mediaId;
  }
  if (Object.keys(cambios).length === 0) {
    return { ok: false, motivo: 'No hay nada que cambiar.' };
  }

  await ChatModel.updateOne({ _id: params.chatId }, { $set: cambios });
  return { ok: true, miembros: chat.members.map((m) => String(m.userId)), nombre: nombreNuevo };
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
