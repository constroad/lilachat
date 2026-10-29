import { Router } from 'express';
import multer from 'multer';
import { MAX_BYTES_BY_KIND, dimensionValida, validateMedia, isAlbumId, sealedMediaSize, type MediaKind } from '@lilachat/shared';
import { Types } from 'mongoose';
import { ChatModel } from './chatModels.js';
import { parseSealedUpload, sealedSizeProblem } from './sealedUpload.js';
import { ForbiddenChatError, mensajePropioPorClave, sendMessage } from './chatService.js';
import { publicarMensaje } from './socket.js';
import { toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { defaultMediaUploader } from './localMediaUploader.js';
import { requireSession } from './requireSession.js';
import { ondaValida } from './ondaDeVoz.js';
import { toClientMessage } from './messageView.js';
import { botsHearMessage } from './bots/botTriggers.js';

/**
 * Subir un archivo y publicarlo como mensaje, en UN request.
 *
 * Son un solo paso a propósito: si la app subiera y después mandara el mensaje,
 * una caída en el medio dejaría archivos huérfanos ocupando storage que nadie
 * puede ver ni borrar.
 *
 * El archivo va en MEMORIA, no a disco: este server puede correr en un release
 * de solo lectura y no tiene por qué dejar temporales; el techo de multer es la
 * red de seguridad antes de que nada toque la RAM de verdad.
 */
const SEALED_NAME = 'sellado';
const SEALED_MIME = 'application/octet-stream';

type Validated = { ok: true; kind: MediaKind } | { ok: false; reason: string };
function sealedValidation(sizeBytes: number, kind: MediaKind): Validated {
  const problem = sealedSizeProblem(sizeBytes, kind);
  return problem ? { ok: false, reason: problem } : { ok: true, kind };
}

/** A sealed file keeps no name, shape or thumbnail: those travel inside the sealed text. */
function sealedMedia(stored: { storageName: string; url: string }, sizeBytes: number) {
  return { mediaId: stored.storageName, fileName: SEALED_NAME, sizeBytes, url: stored.url, mime: SEALED_MIME };
}

/** Who is not a member gets 403; a plain file in a secret chat 403, a sealed one in an ordinary chat 400. */
async function chatProblem(chatId: string, userId: Types.ObjectId, sealed: boolean): Promise<{ status: number; message: string } | null> {
  if (!Types.ObjectId.isValid(chatId)) return { status: 403, message: 'No eres parte de este chat.' };
  const chat = await ChatModel.findOne({ _id: chatId, 'members.userId': userId }).select('encrypted').lean<{ encrypted?: boolean } | null>();
  if (!chat) return { status: 403, message: 'No eres parte de este chat.' };
  if (chat.encrypted && !sealed) return { status: 403, message: 'Este chat es secreto: el archivo tiene que ir cifrado.' };
  if (!chat.encrypted && sealed) return { status: 400, message: 'Solo un chat secreto recibe archivos cifrados.' };
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  // A sealed video is a little bigger than the plain one (one tag per chunk).
  limits: { fileSize: sealedMediaSize(Math.max(...Object.values(MAX_BYTES_BY_KIND))) },
});

export function buildMediaRouter(uploader: MediaUploader = defaultMediaUploader()): Router {
  const router = Router();
  router.use(requireSession);

  router.post('/', upload.single('file'), async (req, res) => {
    const file = req.file;
    const chatId = String(req.body?.chatId ?? '');
    const clientKey = String(req.body?.clientKey ?? '');
    if (!file || !chatId || !clientKey) {
      return res.status(400).json({ message: 'Faltan datos para subir el archivo.' });
    }

    const sealed = parseSealedUpload(req.body);
    if (sealed && !sealed.ok) return res.status(400).json({ message: sealed.message });
    const validation = sealed ? sealedValidation(file.size, sealed.kind) : validateMedia({ mimeType: file.mimetype, sizeBytes: file.size });
    if (!validation.ok) return res.status(413).json({ message: validation.reason });

    try {
      // El reintento (el teléfono no vio la respuesta) se reconoce ANTES de
      // subir: si no, el archivo viajaba otra vez a lila y quedaba huérfano.
      const previo = await mensajePropioPorClave({ chatId, senderId: req.session!.userId, clientKey });
      if (previo) {
        return res.status(200).json({
          message: toClientMessage(previo),
          duplicate: true,
          url: toAbsoluteMediaUrl(previo.media?.url ?? ''),
          thumbnailUrl: toAbsoluteMediaUrl(previo.media?.thumbUrl ?? ''),
        });
      }
      // Checked BEFORE storing anything: a plain photo in a secret chat, or a
      // sealed one in an ordinary chat, used to be stored and then refused.
      const problem = await chatProblem(chatId, req.session!.userId, Boolean(sealed));
      if (problem) return res.status(problem.status).json({ message: problem.message });
      const uploaded = await uploader.upload({
        chatId,
        fileName: sealed ? SEALED_NAME : file.originalname,
        mimeType: sealed ? SEALED_MIME : file.mimetype,
        // As a plain file: no thumbnail is tried on bytes nobody can read here.
        kind: sealed ? 'file' : validation.kind,
        bytes: file.buffer,
      });
      if (!uploaded.ok) {
        // Distinguir «no pude preguntar» de «me dijeron que no»: el 503 es
        // reintentable y la app no descarta la foto del usuario.
        const retryable = uploaded.codigo !== 'rechazado';
        return res.status(retryable ? 503 : 502).json({
          message: retryable
            ? 'No se pudo subir ahora. Inténtalo de nuevo.'
            : 'El archivo no se pudo guardar.',
        });
      }

      // El mensaje se crea por el MISMO servicio que el texto: membresía,
      // `seq` e idempotencia por `clientKey` no se re-implementan acá.
      const result = await sendMessage({
        chatId,
        senderId: req.session!.userId,
        clientKey,
        kind: validation.kind,
        ...(sealed?.ok ? { envelope: sealed.envelope } : { body: typeof req.body?.caption === 'string' ? req.body.caption.trim() : undefined }),
        media: sealed ? sealedMedia(uploaded.media, file.size) : {
          mediaId: uploaded.media.storageName,
          // El nombre que la persona ve en su teléfono, no el del storage.
          fileName: file.originalname,
          sizeBytes: file.size,
          // La duración real de una nota de voz. El `m4a` remoto reporta mal su
          // duración hasta que carga entero, así que en reposo se muestra ESTA.
          durationMs: Number(req.body?.durationMs) || undefined,
          // Ancho y alto de la foto o el video (FL9): la burbuja respeta su
          // forma. Lo que no es un entero razonable se ignora.
          width: dimensionValida(req.body?.width),
          height: dimensionValida(req.body?.height),
          // La onda de una nota de voz (FL9): barras de 0 a 100.
          onda: ondaValida(req.body?.onda),
          // Sent together (pending 12): the same album id, and the chat draws one card.
          album: isAlbumId(req.body?.albumId) ? req.body.albumId : undefined,
          // RELATIVAS a propósito: se resuelven al servir (`messageView`).
          thumbUrl: uploaded.media.thumbnailUrl,
          url: uploaded.media.url,
          mime: file.mimetype,
        },
      });

      /**
       * **El aviso por socket, que faltaba.**
       *
       * Este camino creaba el mensaje —quedaba en la base con su `seq`— pero no
       * emitía `msg.new`, porque el emit vivía solo dentro del handler del
       * socket. Resultado: una foto no aparecía en el chat de nadie, ni del que
       * la mandó, hasta reabrir la conversación. Visto el 27/08/2026 mirando la
       * base y la pantalla al mismo tiempo.
       *
       * Va ANTES de responder y con `await`: si se emitiera después del `res`,
       * un fallo acá quedaría sin dueño. Un duplicado no re-emite: el mensaje ya
       * se repartió cuando se creó de verdad.
       */
      if (!result.duplicate) await publicarMensaje(result.message, result.members);
      // A voucher sent to an app (pending 90): it hears the file by a signed address. Never awaited by who sent it.
      if (!result.duplicate) void botsHearMessage(result.message, result.members ?? []).catch((error) => console.error('[bots] no se pudo avisar el archivo:', error?.message ?? error));

      // En la forma del socket (URLs absolutas): la app pinta el mensaje
      // confirmado con esto, sin esperar el `msg.new` (auditoría 19/10).
      res.status(201).json({
        message: toClientMessage(result.message),
        duplicate: result.duplicate,
        url: toAbsoluteMediaUrl(uploaded.media.url),
        thumbnailUrl: toAbsoluteMediaUrl(uploaded.media.thumbnailUrl ?? ''),
      });
    } catch (error) {
      if (error instanceof ForbiddenChatError) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  });

  return router;
}
