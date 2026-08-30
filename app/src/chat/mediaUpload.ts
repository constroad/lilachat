import { resolveMediaKind, validateMedia } from '@lilachat/shared';
import { subirPorXhr } from './subidaXhr';

/**
 * Subida de un archivo desde el teléfono. Va por HTTP y no por el socket: son
 * megabytes, y el socket es para frames chicos y de baja latencia.
 *
 * **Sube por XHR y no por `fetch`**: el porqué está en `subidaXhr.ts`, que es
 * la plomería compartida con la foto del grupo.
 *
 * No pasa por el outbox de texto a propósito: el outbox persiste el CONTENIDO
 * de lo encolado, y guardar copias de videos en AsyncStorage llenaría el
 * teléfono. Una foto que falla se reintenta desde su archivo original, que ya
 * vive en el disco del sistema.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';
const UPLOAD_TIMEOUT_MS = 120_000;

export type UploadResult =
  | { ok: true; seq: number; url: string; thumbnailUrl?: string }
  | { ok: false; reason: string; retryable: boolean };

export async function uploadMedia(params: {
  token: string;
  chatId: string;
  clientKey: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  /** La duración real de una nota de voz, en ms: lo que se muestra en reposo. */
  durationMs?: number;
  /** 0→1 mientras suben los bytes. Un video sin progreso parece colgado. */
  onProgress?: (ratio: number) => void;
}): Promise<UploadResult> {
  // La MISMA validación que el server (motor compartido): así el usuario se
  // entera antes de esperar una subida que iba a morir al final.
  const validation = validateMedia({ mimeType: params.mimeType, sizeBytes: params.sizeBytes });
  if (!validation.ok) return { ok: false, reason: validation.reason, retryable: false };

  const form = new FormData();
  form.append('chatId', params.chatId);
  form.append('clientKey', params.clientKey);
  if (params.caption) form.append('caption', params.caption);
  if (params.durationMs) form.append('durationMs', String(params.durationMs));
  // El archivo se adjunta por URI: el módulo nativo lo lee del disco al armar
  // el multipart, sin pasar por memoria JS.
  form.append('file', {
    uri: params.uri,
    name: params.fileName,
    type: params.mimeType,
  } as unknown as Blob);

  const respuesta = await subirPorXhr({
    url: `${BASE_URL}/api/media`,
    token: params.token,
    form,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    onProgress: params.onProgress,
  });
  if (respuesta.tipo === 'fallo') {
    return { ok: false, reason: respuesta.motivo, retryable: respuesta.reintentable };
  }

  const payload = respuesta.payload;
  if (respuesta.status < 200 || respuesta.status >= 300) {
    // 503 = storage caído (se reintenta); 413/403/502 = este archivo no va.
    return {
      ok: false,
      reason: typeof payload.message === 'string' ? payload.message : 'No se pudo enviar.',
      retryable: respuesta.status === 503,
    };
  }
  const message = payload.message as { seq: number } | undefined;
  return {
    ok: true,
    seq: message?.seq ?? 0,
    url: String(payload.url ?? ''),
    thumbnailUrl: typeof payload.thumbnailUrl === 'string' ? payload.thumbnailUrl : undefined,
  };
}

export { resolveMediaKind };
