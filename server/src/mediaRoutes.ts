import { Router } from 'express';
import multer from 'multer';
import { MAX_BYTES_BY_KIND, dimensionValida, validateMedia } from '@lilachat/shared';
import { ForbiddenChatError, mensajePropioPorClave, sendMessage } from './chatService.js';
import { publicarMensaje } from './socket.js';
import { buildLilaUploader, toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { requireSession } from './requireSession.js';
import { ondaValida } from './ondaDeVoz.js';
import { toClientMessage } from './messageView.js';

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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(...Object.values(MAX_BYTES_BY_KIND)) },
});

export function buildMediaRouter(uploader: MediaUploader = buildLilaUploader()): Router {
  const router = Router();
  router.use(requireSession);

  router.post('/', upload.single('file'), async (req, res) => {
    const file = req.file;
    const chatId = String(req.body?.chatId ?? '');
    const clientKey = String(req.body?.clientKey ?? '');
    if (!file || !chatId || !clientKey) {
      return res.status(400).json({ message: 'Faltan datos para subir el archivo.' });
    }

    const validation = validateMedia({ mimeType: file.mimetype, sizeBytes: file.size });
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
      const uploaded = await uploader.upload({
        chatId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        kind: validation.kind,
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
        body: typeof req.body?.caption === 'string' ? req.body.caption.trim() : undefined,
        media: {
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
