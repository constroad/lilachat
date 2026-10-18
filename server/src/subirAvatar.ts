import multer from 'multer';
import { MAX_BYTES_BY_KIND, validateMedia } from '@lilachat/shared';
import type { MediaUploader } from './mediaClient.js';

/**
 * Subir una foto redonda —la del grupo o la del perfil (FL9)—. Va en MEMORIA y
 * con techo propio: es una imagen, no un archivo cualquiera, y este server
 * puede correr en un release de solo lectura.
 */
export const multerDeAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_BY_KIND.image },
});

export type FotoSubida = { ok: true; url: string; mediaId: string } | { ok: false; status: number; message: string };

export async function subirFotoRedonda(params: {
  uploader: MediaUploader;
  file: Express.Multer.File | undefined;
  /** La carpeta en el storage (el `chatId` del uploader). */
  carpeta: string;
  nombrePorDefecto: string;
  /** El aviso si no es una imagen: la lista dibuja una foto redonda. */
  siNoEsImagen: string;
}): Promise<FotoSubida> {
  const { file } = params;
  if (!file) return { ok: false, status: 400, message: 'Falta la foto.' };

  const validado = validateMedia({ mimeType: file.mimetype, sizeBytes: file.size });
  if (!validado.ok) return { ok: false, status: 413, message: validado.reason };
  if (validado.kind !== 'image') return { ok: false, status: 400, message: params.siNoEsImagen };

  const subida = await params.uploader.upload({
    chatId: params.carpeta,
    fileName: file.originalname || params.nombrePorDefecto,
    mimeType: file.mimetype,
    kind: 'image',
    bytes: file.buffer,
  });
  if (subida.ok) return { ok: true, url: subida.media.url, mediaId: subida.media.storageName };
  // Distinguir «no pude preguntar» de «me dijeron que no»: el 503 es
  // reintentable y la app no descarta la foto que eligió la persona.
  const reintentable = subida.codigo !== 'rechazado';
  return reintentable
    ? { ok: false, status: 503, message: 'No se pudo subir ahora. Prueba de nuevo.' }
    : { ok: false, status: 502, message: 'La foto no se pudo guardar.' };
}
