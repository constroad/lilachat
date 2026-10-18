import { retryDelayMs } from '@lilachat/shared';
import type { UploadResult } from './mediaUpload';

/**
 * Lo puro de la cola de archivos (FL8): las mismas reglas que la cola de texto
 * (`shared/outbox`). Sin red se reintenta con espera creciente; lo rechazado
 * para siempre queda FALLIDO con su motivo, a la vista; nada desaparece solo.
 */
export type ArchivoEnCola = {
  /** Idempotencia: el server no duplica el mensaje si la subida se repite. */
  clientKey: string;
  chatId: string;
  /** La COPIA en la carpeta de la app (no la de la caché, que el sistema limpia). */
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  /** El pie de una foto (FL9b): viaja con ella. */
  caption?: string;
  /** La forma de la foto o el video (FL9): la burbuja la respeta. */
  width?: number;
  height?: number;
  queuedAt: string;
  intentos: number;
  fallo?: string;
};

export type DecisionDeSubida = { accion: 'confirmar' } | { accion: 'reintentar'; esperaMs: number } | { accion: 'fallar'; motivo: string };

export function decidirSubida(resultado: UploadResult, archivo: ArchivoEnCola): DecisionDeSubida {
  if (resultado.ok) return { accion: 'confirmar' };
  if (resultado.retryable) return { accion: 'reintentar', esperaMs: retryDelayMs(archivo.intentos) };
  return { accion: 'fallar', motivo: resultado.reason };
}

/** El próximo a subir: en orden, salteando los fallidos (no bloquean a los de atrás). */
export function siguienteArchivo(cola: readonly ArchivoEnCola[]): ArchivoEnCola | null {
  return cola.find((archivo) => !archivo.fallo) ?? null;
}
