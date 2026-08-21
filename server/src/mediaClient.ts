import jwt from 'jsonwebtoken';
import { buildMediaPath, buildStorageName, type MediaKind } from '@lilachat/shared';

/**
 * Subida al storage de lila. Contrato copiado del código VIVO
 * (`lila-app/src/api/controllers/drive.controller.ts` y sus rutas), no
 * inventado:
 *
 *   POST {LILA}/api/drive/files   multipart: `file` + `path`
 *   Authorization: Bearer <JWT con {companyId}>
 *   201 → { success, data: { url, urlAbsolute, size, thumbnailUrl?, thumbnailStatus, streamUrl? } }
 *
 * **El teléfono nunca sube directo a lila**: subiría con una credencial que
 * viajaría dentro del APK. Sube a Lilachat, y Lilachat —que corre en un
 * servidor— habla con lila. Mismo principio que con constroad-auth.
 */

const COMPANY_ID = 'constroad';
const UPLOAD_TIMEOUT_MS = 120_000;

export type UploadedMedia = {
  /** Ruta relativa servida por lila: `/files/companies/…`. */
  url: string;
  thumbnailUrl?: string;
  thumbnailStatus?: string;
  streamUrl?: string;
  sizeBytes: number;
  storageName: string;
};

export type UploadOutcome =
  | { ok: true; media: UploadedMedia }
  | { ok: false; codigo: 'sin_configurar' | 'sin_respuesta' | 'rechazado'; message?: string };

function credentials(): { base: string; secret: string } | null {
  const base = process.env.LILA_SERVER_URL || '';
  const secret = process.env.LILA_APP_JWT_SECRET || '';
  // Fail-closed: sin config, el síntoma del otro lado sería un 401 sin
  // explicación y el paseo para descubrirlo es largo.
  return base && secret ? { base, secret } : null;
}

export interface MediaUploader {
  upload(params: {
    chatId: string;
    fileName: string;
    mimeType: string;
    kind: MediaKind;
    bytes: Buffer;
  }): Promise<UploadOutcome>;
}

export function buildLilaUploader(): MediaUploader {
  return {
    async upload(params) {
      const creds = credentials();
      if (!creds) return { ok: false, codigo: 'sin_configurar' };

      const token = jwt.sign({ companyId: COMPANY_ID, userId: 'lilachat', role: 'admin' }, creds.secret, {
        expiresIn: '10m',
      });
      const storageName = buildStorageName(params.fileName, params.kind, new Date());

      const form = new FormData();
      form.append('path', buildMediaPath(params.chatId));
      form.append(
        'file',
        new Blob([new Uint8Array(params.bytes)], { type: params.mimeType }),
        storageName
      );

      try {
        const response = await fetch(`${creds.base}/api/drive/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        });
        const payload = (await response.json().catch(() => null)) as {
          data?: Record<string, unknown>;
          message?: string;
        } | null;

        if (!response.ok || !payload?.data) {
          return { ok: false, codigo: 'rechazado', message: payload?.message };
        }
        const data = payload.data;
        return {
          ok: true,
          media: {
            url: String(data.url ?? ''),
            thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
            thumbnailStatus:
              typeof data.thumbnailStatus === 'string' ? data.thumbnailStatus : undefined,
            streamUrl: typeof data.streamUrl === 'string' ? data.streamUrl : undefined,
            sizeBytes: Number(data.size ?? params.bytes.length),
            storageName,
          },
        };
      } catch {
        // Timeout o red: NO es un rechazo del archivo. Quien llama tiene que
        // poder distinguirlo para reintentar en vez de descartar la foto.
        return { ok: false, codigo: 'sin_respuesta' };
      }
    },
  };
}

/**
 * URL absoluta para el cliente. lila devuelve la ruta relativa y el host lo
 * pone el server: si se persistiera absoluta, un cambio de hosting dejaría
 * enlaces rotos en todos los mensajes viejos (ya pasó en Portal).
 */
let missingBaseWarned = false;

export function toAbsoluteMediaUrl(relativeUrl: string): string {
  const base = (process.env.LILA_PUBLIC_URL || process.env.LILA_SERVER_URL || '').replace(/\/$/, '');
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http')) return relativeUrl;
  if (!base && !missingBaseWarned) {
    // Sin base, el cliente recibe `/files/…` y NINGUNA imagen carga — un fallo
    // mudo que en el E2E de F3 costó buscar del lado equivocado. Se avisa una
    // vez: no se lanza, porque una miniatura rota no justifica tumbar el chat.
    missingBaseWarned = true;
    console.error('[media] falta LILA_PUBLIC_URL: las imágenes no van a cargar en el cliente');
  }
  return `${base}${relativeUrl}`;
}
