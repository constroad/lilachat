import { resolveMediaKind, validateMedia } from '@lilachat/shared';

/**
 * Subida de un archivo desde el teléfono. Va por HTTP y no por el socket: son
 * megabytes, y el socket es para frames chicos y de baja latencia.
 *
 * **Se usa XMLHttpRequest, no `fetch`.** Expo SDK 57 reemplazó el `fetch`
 * global por su implementación «winter», cuyo FormData solo acepta strings o
 * Blobs: el `{uri, name, type}` clásico de React Native muere con
 * «Unsupported FormDataPart implementation» (lo encontró el E2E de F3). La
 * alternativa —leer el archivo a un Blob— cargaría 90 MB de video en memoria
 * JS, que además es lo que corrompe archivos grandes en Expo. XHR sigue
 * subiendo desde DISCO de forma nativa, y de paso da progreso.
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
  // El archivo se adjunta por URI: el módulo nativo lo lee del disco al armar
  // el multipart, sin pasar por memoria JS.
  form.append('file', {
    uri: params.uri,
    name: params.fileName,
    type: params.mimeType,
  } as unknown as Blob);

  return new Promise<UploadResult>((resolve) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${BASE_URL}/api/media`);
    request.timeout = UPLOAD_TIMEOUT_MS;
    request.setRequestHeader('Authorization', `Bearer ${params.token}`);
    // El Content-Type NO se pone a mano: lleva el boundary que genera el nativo.

    request.upload.onprogress = (event) => {
      if (params.onProgress && event.total > 0) {
        params.onProgress(event.loaded / event.total);
      }
    };

    request.onload = () => {
      const payload = parseJson(request.responseText);
      if (request.status < 200 || request.status >= 300) {
        // 503 = storage caído (se reintenta); 413/403/502 = este archivo no va.
        resolve({
          ok: false,
          reason: typeof payload.message === 'string' ? payload.message : 'No se pudo enviar.',
          retryable: request.status === 503,
        });
        return;
      }
      const message = payload.message as { seq: number } | undefined;
      resolve({
        ok: true,
        seq: message?.seq ?? 0,
        url: String(payload.url ?? ''),
        thumbnailUrl: typeof payload.thumbnailUrl === 'string' ? payload.thumbnailUrl : undefined,
      });
    };

    const fail = (motivo: string) => () =>
      resolve({ ok: false, reason: motivo, retryable: true });
    request.onerror = fail('Sin conexión. Inténtalo de nuevo.');
    request.ontimeout = fail('La subida tardó demasiado. Inténtalo de nuevo.');
    request.onabort = fail('Subida cancelada.');

    request.send(form);
  });
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export { resolveMediaKind };
