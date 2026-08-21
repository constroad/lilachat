/**
 * Reglas de los archivos que se mandan por chat. Motor PURO.
 *
 * Vive en `shared/` porque el server y el cliente tienen que decidir LO MISMO:
 * si el cliente aceptara algo que el server rechaza, el usuario ve una subida
 * que avanza y muere al final — el peor momento para enterarse.
 */

export type MediaKind = 'image' | 'video' | 'file';

/**
 * Techos por tipo. El de imagen es alto A PROPÓSITO: la queja más repetida
 * contra WhatsApp es que recomprime las fotos, y acá se guarda el original.
 * lila igual tiene su propio techo (100 MB fuera de la raíz `drive`), así que
 * estos números son el contrato que el usuario ve, no la única defensa.
 */
export const MAX_BYTES_BY_KIND: Record<MediaKind, number> = {
  image: 25 * 1024 * 1024,
  video: 90 * 1024 * 1024,
  file: 90 * 1024 * 1024,
};

export function resolveMediaKind(mimeType: string): MediaKind {
  const mime = String(mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

export type MediaValidation = { ok: true; kind: MediaKind } | { ok: false; reason: string };

export function validateMedia(params: { mimeType: string; sizeBytes: number }): MediaValidation {
  const size = Number(params.sizeBytes);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'El archivo está vacío.' };
  }
  const kind = resolveMediaKind(params.mimeType);
  const max = MAX_BYTES_BY_KIND[kind];
  if (size > max) {
    return { ok: false, reason: `Ese archivo pesa más de ${formatBytes(max)}.` };
  }
  return { ok: true, kind };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unitIndex]}`;
}

/**
 * Dónde vive el archivo dentro del storage de la empresa.
 *
 * **Fuera de la raíz `drive`** a propósito: bajo `drive/` los archivos
 * aparecerían en el explorador del Portal, y el chat privado de alguien no
 * tiene por qué mezclarse con los documentos de la empresa.
 *
 * Una carpeta por chat: hace barato borrar una conversación entera y evita un
 * directorio con decenas de miles de archivos.
 */
export function buildMediaPath(chatId: string): string {
  const safeChatId = String(chatId).replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeChatId) throw new Error('chatId inválido para la ruta de media');
  return `apps/lilachat/${safeChatId}`;
}

/**
 * Nombre con el que se guarda. Se conserva la extensión —es lo que decide con
 * qué app se abre en el teléfono— y se limpia el resto: el nombre lo pone
 * quien sube, así que es input del usuario y no puede llevar rutas.
 */
export function buildStorageName(originalName: string, kind: MediaKind, at: Date): string {
  const clean = String(originalName ?? '')
    .split(/[\\/]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  const extension = clean.includes('.') ? clean.slice(clean.lastIndexOf('.')) : '';
  const stamp = at.toISOString().replace(/[:.]/g, '-');
  return `${kind}-${stamp}${extension || defaultExtension(kind)}`;
}

const defaultExtension = (kind: MediaKind): string =>
  kind === 'image' ? '.jpg' : kind === 'video' ? '.mp4' : '.bin';

/** Lo que se muestra en la lista de chats cuando el último mensaje es media. */
export function mediaPreviewLabel(kind: MediaKind): string {
  return kind === 'image' ? '📷 Foto' : kind === 'video' ? '🎬 Video' : '📎 Archivo';
}
