import { Router } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { MAX_BYTES_BY_KIND, textoDeAviso, validateMedia } from '@lilachat/shared';
import { ChatModel } from './chatModels.js';
import { DeviceModel, UserModel } from './models.js';
import {
  ForbiddenChatError,
  addMember,
  leaveChat,
  listChats,
  listMessages,
  cambiarAjustesDeChat,
  changeRole,
  editarInfoDeGrupo,
  datosDeUsuario,
  escribirAviso,
  markRead,
  removeMember,
} from './chatService.js';
import { toClientMessages } from './messageView.js';
import { buildLilaUploader, toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { avisarCambioDeChat, avisarMensajeNuevo } from './socket.js';
import { requireSession } from './requireSession.js';

/**
 * REST de chats: el arranque de la app (lista e historial). El tiempo real va
 * por el socket, pero el historial paginado no: pedirle 50 mensajes viejos a un
 * socket es peor que un GET que se cachea y se reintenta solo.
 */
/**
 * La foto del grupo va en MEMORIA y con techo propio: es una imagen, no un
 * archivo cualquiera, y este server puede correr en un release de solo lectura.
 */
const subirAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_BY_KIND.image },
});

/**
 * Escribir el aviso del cambio DENTRO del chat, y empujarlo por el socket.
 *
 * El texto de respaldo se arma con `textoDeAviso` —la misma función que usa el
 * teléfono— para que no existan dos copias de la misma frase que se separen en
 * el primer cambio de copy. Lo que cambia es el nombre: acá va el que conoce el
 * server; en el teléfono, el de la agenda de quien mira.
 */
async function avisarEnElChat(params: {
  chatId: string;
  quien: Types.ObjectId;
  evento: string;
  targetId?: string;
  valor?: string;
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

  const mensaje = await escribirAviso({
    ...params,
    body,
    quien2: { phone: quien.phone, name: quien.name },
    aQuien2: aQuien ? { phone: aQuien.phone, name: aQuien.name } : undefined,
  });
  // En un chat cifrado no se escribe: `escribirAviso` devuelve null y no hay
  // nada que empujar.
  if (mensaje) await avisarMensajeNuevo(mensaje);
}

export function buildChatRouter(uploader: MediaUploader = buildLilaUploader()): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/', async (req, res) => {
    res.json({ chats: await listChats(req.session!.userId) });
  });

  router.post('/', async (req, res) => {
    const kind = req.body?.kind === 'group' ? 'group' : 'direct';
    const rawMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const memberIds = rawMembers
      .map((value: unknown) => String(value))
      .filter((value: string) => Types.ObjectId.isValid(value))
      .map((value: string) => new Types.ObjectId(value));

    // El creador SIEMPRE va adentro, aunque no se haya incluido: un chat sin su
    // autor es un chat que nadie puede abrir.
    const me = req.session!.userId;
    const unique = new Map<string, Types.ObjectId>([[String(me), me]]);
    for (const id of memberIds) unique.set(String(id), id);
    if (unique.size < 2) {
      return res.status(400).json({ message: 'Elige con quién quieres hablar.' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

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
      members: [...unique.values()].map((userId) => ({
        userId,
        role: String(userId) === String(me) ? 'admin' : 'member',
      })),
      lastSeq: 0,
    });
    res.status(201).json({ chatId: String(chat._id) });
  });

  /**
   * El detalle de una conversación: quiénes están y con qué rol.
   *
   * Existe para la pantalla «Chat Detail» del diseño
   * (`design/stitch/info-grupo-alpha.png`), que estaba diseñada y sin
   * implementar. `GET /api/chats` da los `memberIds` pero no los nombres, así
   * que la pantalla no tenía con qué dibujar la lista.
   *
   * **Devuelve el teléfono de cada miembro** por el mismo motivo que el resumen
   * del chat (§ del nombre de contacto): el server solo conoce el nombre que
   * cada uno se puso, y el que importa —el de TU agenda— solo lo puede resolver
   * el teléfono. No filtra nada nuevo: son las personas con las que ya compartís
   * una conversación.
   */
  router.get('/:chatId/detail', async (req, res) => {
    const userId = new Types.ObjectId(req.session!.userId);
    // La membresía primero: sin esto se podría sondear la existencia de chats
    // ajenos por la diferencia entre «no existe» y «no permitido».
    const chat = await ChatModel.findOne({
      _id: req.params.chatId,
      'members.userId': userId,
    }).lean();
    if (!chat) return res.status(404).json({ message: 'No encontramos esa conversación.' });

    const ids = chat.members.map((m) => m.userId);
    const personas = await UserModel.find({ _id: { $in: ids } })
      .select('name phone')
      .lean<{ _id: unknown; name?: string; phone: string }[]>();
    const porId = new Map(personas.map((persona) => [String(persona._id), persona]));

    return res.json({
      id: String(chat._id),
      kind: chat.kind,
      name: chat.name,
      encrypted: chat.encrypted === true,
      avatarUrl: chat.avatarUrl ? toAbsoluteMediaUrl(chat.avatarUrl) : undefined,
      members: chat.members.map((m) => {
        const persona = porId.get(String(m.userId));
        return {
          id: String(m.userId),
          name: persona?.name ?? null,
          phone: persona?.phone ?? null,
          role: m.role ?? 'member',
          esYo: String(m.userId) === String(userId),
        };
      }),
    });
  });

  /**
   * Silenciar / fijar un chat, para MÍ.
   *
   * `PATCH` con `{muted?, pinned?}`. Lo usa la selección múltiple de la lista.
   * Son ajustes por-usuario: viven en el subdoc del miembro, no en el chat.
   */
  router.patch('/:chatId/ajustes', async (req, res) => {
    const r = await cambiarAjustesDeChat({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      muted: typeof req.body?.muted === 'boolean' ? req.body.muted : undefined,
      pinned: typeof req.body?.pinned === 'boolean' ? req.body.pinned : undefined,
    });
    if (!r.ok) return res.status(400).json({ message: r.motivo });
    return res.status(200).json({ ok: true });
  });

  /**
   * Cambiar el nombre del grupo.
   *
   * `PATCH` sobre el chat, no sobre una membresía: lo que cambia es el chat.
   */
  router.patch('/:chatId', async (req, res) => {
    const r = await editarInfoDeGrupo({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      nombre: req.body?.name,
    });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    // El nombre se ve en la lista de TODOS, no solo de quien lo cambió.
    for (const id of r.miembros) avisarCambioDeChat(id, req.params.chatId!);
    await avisarEnElChat({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      evento: 'nombre',
      valor: r.nombre,
    });
    return res.status(200).json({ ok: true, name: r.nombre });
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
  router.post('/:chatId/avatar', subirAvatar.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Falta la foto.' });

    const validado = validateMedia({ mimeType: file.mimetype, sizeBytes: file.size });
    if (!validado.ok) return res.status(413).json({ message: validado.reason });
    // Un video no es una foto de grupo: la lista dibuja una imagen redonda.
    if (validado.kind !== 'image') {
      return res.status(400).json({ message: 'La foto del grupo tiene que ser una imagen.' });
    }

    const subida = await uploader.upload({
      chatId: req.params.chatId!,
      fileName: file.originalname || 'grupo.jpg',
      mimeType: file.mimetype,
      kind: 'image',
      bytes: file.buffer,
    });
    if (!subida.ok) {
      // Distinguir «no pude preguntar» de «me dijeron que no»: el 503 es
      // reintentable y la app no descarta la foto que eligió la persona.
      const reintentable = subida.codigo !== 'rechazado';
      return res.status(reintentable ? 503 : 502).json({
        message: reintentable
          ? 'No se pudo subir ahora. Probá de nuevo.'
          : 'La foto no se pudo guardar.',
      });
    }

    const r = await editarInfoDeGrupo({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      avatar: { url: subida.media.url, mediaId: subida.media.storageName },
    });
    if (!r.ok) return res.status(400).json({ message: r.motivo });

    for (const id of r.miembros) avisarCambioDeChat(id, req.params.chatId!);
    await avisarEnElChat({
      chatId: req.params.chatId!,
      quien: new Types.ObjectId(req.session!.userId),
      evento: 'foto',
    });
    // La URL vuelve ABSOLUTA: la pantalla la pinta sin esperar a recargar.
    return res.status(200).json({ ok: true, avatarUrl: toAbsoluteMediaUrl(subida.media.url) });
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

  router.get('/:chatId/messages', async (req, res) => {
    try {
      const beforeSeq = Number(req.query.beforeSeq);
      const messages = await listMessages({
        chatId: String(req.params.chatId),
        userId: req.session!.userId,
        limit: Number(req.query.limit) || undefined,
        beforeSeq: Number.isFinite(beforeSeq) && beforeSeq > 0 ? beforeSeq : undefined,
      });
      // `lastSeq` viaja CON la página: es el tope real del chat en este mismo
      // instante, y con él el teléfono puede tirar lo que guardó de más. Que lo
      // calcule el cliente sería una carrera —un mensaje llegado entre el
      // pedido y la respuesta se borraría de la pantalla—.
      const chat = await ChatModel.findById(req.params.chatId).select('lastSeq').lean();
      res.json({ messages: toClientMessages(messages), lastSeq: chat?.lastSeq ?? 0 });
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
    await DeviceModel.updateOne(
      { deviceId: req.session!.deviceId },
      { $set: { pushToken, platform: 'android' } }
    );
    res.json({ ok: true });
  });

  return router;
}
