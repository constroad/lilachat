import { Router } from 'express';
import multer from 'multer';
import { MAX_BYTES_BY_KIND, validateMedia } from '@lilachat/shared';
import { ForbiddenChatError, sendMessage } from './chatService.js';
import { buildLilaUploader, toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { requireSession } from './requireSession.js';

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
          // RELATIVAS a propósito: se resuelven al servir (`messageView`).
          thumbUrl: uploaded.media.thumbnailUrl,
          url: uploaded.media.url,
          mime: file.mimetype,
        },
      });

      res.status(201).json({
        message: result.message,
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
