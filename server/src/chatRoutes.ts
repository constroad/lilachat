import { allActiveIn } from './workspaceChats.js';
import { ensureGeneralChannel } from './workspaceGeneral.js';
import { activityCounts } from './activityRoutes.js';
import { Router } from 'express';
import { Types } from 'mongoose';
import { PUSH_CAPABILITIES, normalizarNombreDeGrupo, NOTIFICATION_LEVELS, notificationLevel, textoDeAviso } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import type { Message } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import {
  ForbiddenChatError,
  buscarMensajes,
  chatMemberIds,
  listMessages,
  datosDeUsuario,
  escribirAviso,
  markRead,
} from './chatService.js';
import { listChats } from './listaDeChats.js';
import {
  addMember,
  borrarChatParaMi,
  cambiarAjustesDeChat,
  changeRole,
  editarInfoDeGrupo,
  leaveChat,
  removeMember,
} from './miembrosDelChat.js';
import {
  cancelarProgramado,
  pendientesDe,
  programarMensaje,
  puedeProgramar,
} from './scheduledMessages.js';
import { toClientMessages } from './messageView.js';
import { buildLilaUploader, toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { avisarCambioDeChat, publicarAviso } from './socket.js';
import { requireSession } from './requireSession.js';
import { multerDeAvatar, subirFotoRedonda } from './subirAvatar.js';
import { infoDeMensaje } from './infoDeMensaje.js';
import { chatDetail } from './chatDetail.js';
import { ONE_PAGE_PARAM_ONLY, readMessagePage } from './messageWindow.js';

/**
 * REST de chats: el arranque de la app (lista e historial). El tiempo real va
 * por el socket, pero el historial paginado no: pedirle 50 mensajes viejos a un
 * socket es peor que un GET que se cachea y se reintenta solo.
 */
/**
 * Escribir el aviso del cambio DENTRO del chat, y empujarlo por el socket.
 *
 * El texto de respaldo se arma con `textoDeAviso` —la misma función que usa el
 * teléfono— para que no existan dos copias de la misma frase que se separen en
 * el primer cambio de copy. Lo que cambia es el nombre: acá va el que conoce el
 * server; en el teléfono, el de la agenda de quien mira.
 */
export async function avisarEnElChat(params: {
  chatId: string;
  quien: Types.ObjectId;
  evento: string;
  targetId?: string;
  valor?: string;
  /** Además de los miembros: el que se sacó también ve «X te sacó» (FL9d). */
  tambienA?: string[];
  /** What the notice is about (pending 76), so a tap opens it. */
  ref?: Message['ref'];
}): Promise<void> {
  const [quien, aQuien] = await Promise.all([
    datosDeUsuario(params.quien),
    params.targetId ? datosDeUsuario(params.targetId) : Promise.resolve(undefined),
  ]);

  const body = textoDeAviso({
    quien: quien.visible,
    esMio: false,
    evento: params.evento,
    aQuien: aQuien?.visible,
    valor: params.valor,
  });
  // Un evento sin sus datos no genera aviso: `textoDeAviso` devuelve vacío y
  // acá se corta, en vez de escribir una frase a medias en la conversación.
  if (!body) return;

  const { tambienA, ...datos } = params;
  const mensaje = await escribirAviso({
    ...datos,
    body,
    quien2: { phone: quien.phone, name: quien.name },
    aQuien2: aQuien ? { phone: aQuien.phone, name: aQuien.name } : undefined,
  });
  // En un chat cifrado no se escribe: `escribirAviso` devuelve null y no hay
  // nada que empujar.
  if (!mensaje) return;
  if (!tambienA?.length) {
    await publicarAviso(mensaje);
    return;
  }
  const miembros = await chatMemberIds(mensaje.chatId);
  await publicarAviso(mensaje, [...new Set([...miembros, ...tambienA])]);
}

export function buildChatRouter(uploader: MediaUploader = buildLilaUploader()): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req, res) => {
    // E1: `?workspace=<id>` lists that space's chats, only for an ACTIVE member.
    const workspace = typeof req.query.workspace === 'string' ? req.query.workspace : undefined;
    if (!workspace) return res.json({ chats: await listChats(req.session!.userId) });
    const workspaceId = Types.ObjectId.isValid(workspace) ? new Types.ObjectId(workspace) : null;
    if (!workspaceId || !(await allActiveIn(workspaceId, [new Types.ObjectId(req.session!.userId)]))) return res.status(404).json({ message: 'Ese espacio no existe o no estás en él.' });
    // The space's #general (22/10) exists before its list is drawn, also for a space born before it.
    await ensureGeneralChannel(workspaceId);
    // The «Hilos» and «Menciones» chips come with the list: one request, not two (22/10).
    const [chats, activity] = await Promise.all([listChats(req.session!.userId, workspaceId), activityCounts(new Types.ObjectId(req.session!.userId), workspaceId)]);
    res.json({ chats, activity });
  });

  // Buscar texto en las conversaciones del usuario. Va ANTES de `/:chatId/...`
  // para que «search» no lo tome como un id de chat.
  router.get('/search', async (req, res) => {
    const consulta = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ resultados: await buscarMensajes(req.session!.userId, consulta) });
  });

  // ---- Mensajes programados (F11) ------------------------------------------
  // `/scheduled` va ANTES de `/:chatId/...` para que no lo tome como un chatId.
  router.get('/scheduled', async (req, res) => {
    res.json({ programados: await pendientesDe(req.session!.userId) });
  });

  router.delete('/scheduled/:id', async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Id inválido.' });
    }
    const cancelado = await cancelarProgramado(
      new Types.ObjectId(req.params.id),
      req.session!.userId
    );
    res.json({ cancelado });
  });

  router.post('/:chatId/schedule', async (req, res) => {
    const { body, sendAt, clientKey } = (req.body ?? {}) as {
      body?: unknown;
      sendAt?: unknown;
      clientKey?: unknown;
    };
    if (typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ message: 'Escribe el mensaje a programar.' });
    }
    if (typeof clientKey !== 'string' || !clientKey) {
      return res.status(400).json({ message: 'Falta la clave del cliente.' });
    }
    const cuando = typeof sendAt === 'string' ? new Date(sendAt) : new Date(NaN);
    if (Number.isNaN(cuando.getTime()) || !puedeProgramar(cuando, new Date())) {
      return res.status(400).json({ message: 'Elige un momento futuro (hasta un año).' });
    }
    if (!Types.ObjectId.isValid(req.params.chatId)) {
      return res.status(400).json({ message: 'Chat inválido.' });
    }
    try {
      const programado = await programarMensaje({
        chatId: new Types.ObjectId(req.params.chatId),
        senderId: req.session!.userId,
        body: body.trim(),
        sendAt: cuando,
        clientKey,
      });
      res.status(201).json(programado);
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      console.error('[lilachat] programar falló:', error);
      res.status(500).json({ message: 'No se pudo programar el mensaje.' });
    }
  });

  router.post('/', async (req, res) => {
    const me = req.session!.userId;
    // EL CHAT CONTIGO (José, 20/10), como el «Tú» de WhatsApp: siempre el mismo,
    // se crea la primera vez. Sin índice único (la base no crea índices sola):
    // dos toques a la vez son de la misma persona y la app no los permite.
    if (req.body?.kind === 'yo') {
      const existente = await ChatModel.findOne({ kind: 'notas', propio: true, 'members.userId': me }).select('_id').lean();
      if (existente) return res.status(200).json({ chatId: String(existente._id) });
      const propio = await ChatModel.create({ kind: 'notas', propio: true, encrypted: false, name: 'Tú', members: [{ userId: me, role: 'admin' }], lastSeq: 0 });
      return res.status(201).json({ chatId: String(propio._id) });
    }
    const kind = req.body?.kind === 'group' ? 'group' : req.body?.kind === 'notas' ? 'notas' : 'direct';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    // UN BORRADOR (José, 19/10): un chat solo contigo y con nombre, para notas,
    // fotos y links. Nunca cifrado —no hay con quién compartir una clave— y
    // nadie más adentro, aunque el pedido traiga miembros.
    if (kind === 'notas') {
      const validado = normalizarNombreDeGrupo(name);
      if (!validado.ok) return res.status(400).json({ message: 'Ponle un nombre al borrador.' });
      const borrador = await ChatModel.create({ kind, encrypted: false, name: validado.nombre, members: [{ userId: me, role: 'admin' }], lastSeq: 0 });
      return res.status(201).json({ chatId: String(borrador._id) });
    }
    const rawMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const memberIds = rawMembers
      .map((value: unknown) => String(value))
      .filter((value: string) => Types.ObjectId.isValid(value))
      .map((value: string) => new Types.ObjectId(value));

    // El creador SIEMPRE va adentro, aunque no se haya incluido: un chat sin su
    // autor es un chat que nadie puede abrir.
    const unique = new Map<string, Types.ObjectId>([[String(me), me]]);
    for (const id of memberIds) unique.set(String(id), id);
    if (unique.size < 2) {
      return res.status(400).json({ message: 'Elige con quién quieres hablar.' });
    }

    // E1: a chat of a company space, only among its ACTIVE members.
    const rawWorkspace = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : undefined;
    const workspaceId = rawWorkspace && Types.ObjectId.isValid(rawWorkspace) ? new Types.ObjectId(rawWorkspace) : undefined;
    if (rawWorkspace && (!workspaceId || !(await allActiveIn(workspaceId, [...unique.values()])))) {
      return res.status(403).json({ message: 'Solo personas activas del espacio pueden estar en sus chats.' });
    }

    // UN GRUPO SIN NOMBRE NO ES USABLE: la lista lo mostraría sin título y no
    // habría forma de distinguirlo de los demás.
    if (kind === 'group' && !name) {
      return res.status(400).json({ message: 'Ponle un nombre al grupo.' });
    }

    // EL 1:1 NO SE DUPLICA.
    //
    // Tocar dos veces a la misma persona desde «nuevo chat» tiene que llevar a
    // la MISMA conversación. Sin esto los mensajes quedan repartidos entre dos
    // chats con la misma persona y no hay forma de juntarlos después.
    //
    // Los GRUPOS sí se repiten a propósito: «Cumpleaños» y «Viaje» con la misma
    // gente son dos conversaciones legítimas.
    if (kind === 'direct') {
      const ids = [...unique.values()];
      const existente = await ChatModel.findOne({
        kind: 'direct',
        'members.userId': { $all: ids },
        members: { $size: ids.length },
        // The 1:1 in a space is not the personal one with the same person (E1).
        workspaceId: workspaceId ?? { $exists: false },
      })
        .select('_id')
        .lean();
      if (existente) return res.status(201).json({ chatId: String(existente._id) });
    }

    const chat = await ChatModel.create({
      kind,
      // Se decide AL CREAR y no se puede cambiar después: un chat que a veces
      // cifra y a veces no da una promesa que nadie puede sostener (F9).
      encrypted: req.body?.encrypted === true,
      name: name || undefined,
      ...(workspaceId ? { workspaceId } : {}),
      members: [...unique.values()].map((userId) => ({
        userId,
        role: String(userId) === String(me) ? 'admin' : 'member',
      })),
      lastSeq: 0,
    });
    res.status(201).json({ chatId: String(chat._id) });
  });

  /** A conversation's detail: who is in it and with what role (`chatDetail.ts`). */
  router.get('/:chatId/detail', async (req, res) => {
    const detail = await chatDetail(String(req.params.chatId), new Types.ObjectId(req.session!.userId));
    if (!detail) return res.status(404).json({ message: 'No encontramos esa conversación.' });
    return res.json(detail);
  });

  /**
   * Silenciar / fijar / archivar / marcar no leído un chat, para MÍ.
   *
   * `PATCH` con `{muted?, pinned?, archived?, markedUnread?}`. Lo usa la
   * selección múltiple de la lista. Son ajustes por-usuario: viven en el
   * subdoc del miembro, no en el chat. Lo que no es booleano se ignora.
   */
  router.patch('/:chatId/ajustes', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const soloBooleano = (valor: unknown) => (typeof valor === 'boolean' ? valor : undefined);
    const r = await cambiarAjustesDeChat({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      muted: soloBooleano(body.muted),
      pinned: soloBooleano(body.pinned),
      archived: soloBooleano(body.archived),
      markedUnread: soloBooleano(body.markedUnread),
      avisos: NOTIFICATION_LEVELS.find((level) => level === body.avisos),
    });
    if (!r.ok) return res.status(400).json({ message: r.motivo });
    // Mis otros dispositivos (la web vinculada, W3a) reflejan el cambio.
    avisarCambioDeChat(String(req.session!.userId), req.params.chatId!);
    return res.status(200).json({ ok: true });
  });

  /** «Info» de un mensaje propio (FL9): leído, entregado o enviado, por miembro. */
  router.get('/:chatId/messages/:seq/info', async (req, res) => {
    const r = await infoDeMensaje({
      chatId: req.params.chatId!,
      seq: Number(req.params.seq),
      quien: new Types.ObjectId(req.session!.userId),
    });
    if (!r.ok) return res.status(404).json({ message: r.motivo });
    return res.json({ miembros: r.miembros });
  });

  /**
   * «Eliminar chat» para MÍ (FL9d): sale de mi lista y su historial deja de
   * llegarme hasta que alguien escriba de nuevo. Al resto no le cambia nada.
   */
  router.post('/:chatId/borrar-para-mi', async (req, res) => {
    const r = await borrarChatParaMi({ chatId: req.params.chatId!, quien: new Types.ObjectId(req.session!.userId) });
    if (!r.ok) return res.status(400).json({ message: r.motivo });
    avisarCambioDeChat(String(req.session!.userId), req.params.chatId!);
    return res.status(200).json({ ok: true });
  });

  /**
   * Cambiar el nombre o la descripción del grupo (`{name?, descripcion?}`).
   *
   * `PATCH` sobre el chat, no sobre una membresía: lo que cambia es el chat.
   */
  router.patch('/:chatId', async (req, res) => {
    const quien = new Types.ObjectId(req.session!.userId);
    const r = await editarInfoDeGrupo({ chatId: req.params.chatId!, quien, nombre: req.body?.name, descripcion: req.body?.descripcion });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    // El nombre se ve en la lista de TODOS, no solo de quien lo cambió.
    for (const id of r.miembros) avisarCambioDeChat(id, req.params.chatId!);
    if (r.nombre !== undefined) await avisarEnElChat({ chatId: req.params.chatId!, quien, evento: 'nombre', valor: r.nombre });
    // La descripción (20/10): el aviso dice que cambió, no el texto (puede ser largo).
    if (r.descripcion !== undefined) await avisarEnElChat({ chatId: req.params.chatId!, quien, evento: 'descripcion', valor: r.descripcion ? undefined : 'borrada' });
    return res.status(200).json({ ok: true, name: r.nombre, descripcion: r.descripcion });
  });

  /**
   * Cambiar la foto del grupo.
   *
   * **Se sube y se guarda en UN request**, igual que la media de los mensajes:
   * si la app subiera primero y guardara después, una caída en el medio dejaría
   * archivos huérfanos que nadie puede ver ni borrar.
   *
   * El permiso se comprueba DESPUÉS de subir, y es a propósito discutible: se
   * gasta una subida que puede terminar rechazada. Al revés habría que leer el
   * chat dos veces, y el caso —alguien que ya no está en el grupo mandando una
   * foto— no es el común.
   */
  router.post('/:chatId/avatar', multerDeAvatar.single('file'), async (req, res) => {
    const subida = await subirFotoRedonda({
      uploader,
      file: req.file,
      carpeta: req.params.chatId!,
      nombrePorDefecto: 'grupo.jpg',
      siNoEsImagen: 'La foto del grupo tiene que ser una imagen.',
    });
    if (!subida.ok) return res.status(subida.status).json({ message: subida.message });

    const r = await editarInfoDeGrupo({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      avatar: { url: subida.url, mediaId: subida.mediaId },
    });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    for (const id of r.miembros) avisarCambioDeChat(id, req.params.chatId!);
    await avisarEnElChat({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      evento: 'foto',
    });
    // La URL vuelve ABSOLUTA: la pantalla la pinta sin esperar a recargar.
    return res.status(200).json({ ok: true, avatarUrl: toAbsoluteMediaUrl(subida.url) });
  });

  /**
   * Sumar a alguien a un grupo.
   *
   * Existe desde el 29/08/2026: la pantalla de detalle tenía el botón «Añadir»
   * apagado, y no era pereza de UI — **el server no sabía hacerlo**. Un botón
   * inerte y una capacidad inexistente se ven igual desde afuera, que es la
   * trampa de dejar botones apagados «por ahora».
   */
  router.post('/:chatId/members', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    const aQuien = String(req.body?.userId ?? '').trim();
    if (!aQuien) return res.status(400).json({ message: 'Falta a quién sumar.' });
    if (!Types.ObjectId.isValid(aQuien)) {
      return res.status(400).json({ message: 'No encontramos a esa persona.' });
    }

    const r = await addMember({ chatId: req.params.chatId!, quien: userId, aQuien });
    // El motivo VIAJA: un «no» mudo en una pantalla de permisos se lee como que
    // la app se colgó, y acá los motivos son accionables («ya está en el grupo»).
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    // A todos los miembros, incluido el nuevo: su lista de chats tiene que
    // mostrarle el grupo sin que tenga que reabrir la app.
    for (const miembro of r.chat.members) {
      avisarCambioDeChat(String(miembro.userId), String(r.chat._id));
    }
    await avisarEnElChat({
      chatId: req.params.chatId!,
      quien: userId,
      evento: 'sumo',
      targetId: aQuien,
    });
    return res.status(200).json({ ok: true });
  });

  /**
   * Sacar a alguien del grupo.
   *
   * Va por `DELETE` y con el id en la ruta: sacar a alguien es borrar una
   * membresía, y el verbo lo dice mejor que un `POST /kick`.
   */
  router.delete('/:chatId/members/:userId', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    const aQuien = String(req.params.userId ?? '').trim();
    if (!Types.ObjectId.isValid(aQuien)) {
      return res.status(400).json({ message: 'No encontramos a esa persona.' });
    }

    const r = await removeMember({ chatId: req.params.chatId!, quien: userId, aQuien });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    // A TODOS los de antes, incluido el que se sacó: sin su aviso el grupo le
    // sigue apareciendo en la lista, y adentro de un chat donde ya no escribe.
    for (const id of r.miembrosPrevios) avisarCambioDeChat(id, req.params.chatId!);
    await avisarEnElChat({
      chatId: req.params.chatId!,
      quien: userId,
      evento: 'saco',
      targetId: aQuien,
      tambienA: [aQuien],
    });
    return res.status(200).json({ ok: true });
  });

  /**
   * Nombrar admin, o dejar de serlo.
   *
   * `PATCH` porque cambia UN campo de una membresía que ya existe; el `DELETE`
   * de al lado la borra, y son cosas distintas.
   */
  router.patch('/:chatId/members/:userId', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    const aQuien = String(req.params.userId ?? '').trim();
    if (!Types.ObjectId.isValid(aQuien)) {
      return res.status(400).json({ message: 'No encontramos a esa persona.' });
    }
    const rol = req.body?.role;
    // La lista de roles es CERRADA: cualquier otra cosa se rechaza en vez de
    // guardarse. Un `role: 'dueño'` en la base no lo entiende nadie después.
    if (rol !== 'admin' && rol !== 'member') {
      return res.status(400).json({ message: 'Ese rol no existe.' });
    }

    const r = await changeRole({ chatId: req.params.chatId!, quien: userId, aQuien, rol });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    for (const id of r.miembros) avisarCambioDeChat(id, req.params.chatId!);
    await avisarEnElChat({
      chatId: req.params.chatId!,
      quien: userId,
      // Renunciar y nombrar son eventos distintos: «dejó de ser admin» no tiene
      // destinatario, y ponerse a uno mismo como destino se leería raro.
      evento: rol === 'admin' ? 'admin' : 'dejo-admin',
      targetId: rol === 'admin' ? aQuien : undefined,
    });
    return res.status(200).json({ ok: true });
  });

  /**
   * Salir de un grupo.
   *
   * Si se va el último admin, `leaveChat` promueve al miembro más antiguo: sin
   * eso queda un grupo que nadie puede administrar nunca más.
   */
  router.post('/:chatId/leave', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    const r = await leaveChat({ chatId: req.params.chatId!, quien: userId });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    // A los que quedan Y a quien se fue: su lista tiene que dejar de mostrarlo.
    for (const id of [...r.miembrosRestantes, String(userId)]) {
      avisarCambioDeChat(id, req.params.chatId!);
    }
    await avisarEnElChat({ chatId: req.params.chatId!, quien: userId, evento: 'salio' });
    // La promoción la decidió el SERVER, no quien se fue: va como su propio
    // aviso, sin autor. Sin esto el grupo cambia de admin en silencio.
    if (r.nuevoAdmin) {
      await avisarEnElChat({
        chatId: req.params.chatId!,
        quien: userId,
        evento: 'admin-auto',
        targetId: r.nuevoAdmin,
      });
    }
    return res.status(200).json({ ok: true });
  });

  // Pages up from the end (`beforeSeq`), a window around an old message and pages down from it (pending 44).
  router.get('/:chatId/messages', async (req, res) => {
    try {
      const pageOf = await readMessagePage(String(req.params.chatId), req.session!.userId, req.query);
      if (pageOf === 'invalid') return res.status(400).json({ message: ONE_PAGE_PARAM_ONLY });
      res.json(pageOf);
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  });

  router.post('/:chatId/read', async (req, res) => {
    const seq = Number(req.body?.seq);
    if (!Number.isFinite(seq) || seq < 0) {
      return res.status(400).json({ message: 'Falta hasta dónde leíste.' });
    }
    try {
      await markRead({ chatId: String(req.params.chatId), userId: req.session!.userId, seq });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  });

  /**
   * El token de push del teléfono. Va contra el DEVICE de la sesión, no contra
   * el usuario: cada aparato tiene el suyo, y notificar al token de un teléfono
   * que se cambió de dueño es peor que no notificar.
   */
  router.post('/push-token', async (req, res) => {
    const pushToken = String(req.body?.pushToken ?? '').trim();
    if (!pushToken) return res.status(400).json({ message: 'Falta el token.' });
    // Lo que sabe hacer con un push (FL8.1). Sin la lista es una versión vieja
    // y se borra: si quedara, le llegarían llamadas que no sabe dibujar.
    const pedidas: unknown[] = Array.isArray(req.body?.capacidades) ? req.body.capacidades : [];
    const capacidades = PUSH_CAPABILITIES.filter((capacidad) => pedidas.includes(capacidad));
    await DeviceModel.updateOne(
      { deviceId: req.session!.deviceId },
      capacidades.length > 0
        ? { $set: { pushToken, platform: 'android', capacidades } }
        : { $set: { pushToken, platform: 'android' }, $unset: { capacidades: 1 } }
    );
    res.json({ ok: true });
  });

  return router;
}
