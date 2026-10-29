import { retryDelayMs } from '@lilachat/shared';
import type { SealedUpload, UploadResult } from './mediaUpload';

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
  /** La onda de una nota de voz (FL9): barras de 0 a 100. */
  onda?: number[];
  /** Sent together with other photos (pending 12): a retry keeps it in its album. */
  albumId?: string;
  queuedAt: string;
  intentos: number;
  fallo?: string;
  /**
   * A secret chat's photo or video (pending 67): the encrypted copy that goes
   * up and the sealed text with its key. `uri` stays the plain copy, for my own bubble.
   */
  sealed?: SealedUpload;
  /**
   * Se está copiando a la carpeta de la app (auditoría 19/10): la burbuja sale
   * ya, con la `uri` original; se sube recién con la copia lista.
   */
  preparando?: boolean;
};

export type DecisionDeSubida = { accion: 'confirmar' } | { accion: 'reintentar'; esperaMs: number } | { accion: 'fallar'; motivo: string };

export function decidirSubida(resultado: UploadResult, archivo: ArchivoEnCola): DecisionDeSubida {
  if (resultado.ok) return { accion: 'confirmar' };
  if (resultado.retryable) return { accion: 'reintentar', esperaMs: retryDelayMs(archivo.intentos) };
  return { accion: 'fallar', motivo: resultado.reason };
}

/** El próximo a subir: en orden, salteando los fallidos (no bloquean a los de atrás). */
export function siguienteArchivo(cola: readonly ArchivoEnCola[]): ArchivoEnCola | null {
  const siguiente = cola.find((archivo) => !archivo.fallo) ?? null;
  // Si todavía se copia, se espera: subir el de atrás primero desordenaría el chat.
  return siguiente?.preparando ? null : siguiente;
}

/** Lo que se guarda en disco: lo que se está copiando no (su `uri` es de la caché). */
export function paraPersistir(cola: readonly ArchivoEnCola[]): ArchivoEnCola[] {
  return cola.filter((archivo) => !archivo.preparando);
}
