/**
 * The menu of one file of a service's Drive (José 19/11, design cc-05): open it, copy its link,
 * copy the file itself, download it and mark a photo before/after. And the name of what is pasted
 * into the Drive (Ctrl+V on a computer, «Pegar del portapapeles» on the APK). PURE: app and web.
 */
import type { ServiceFile } from './serviceFiles.js';

export type DriveFileActionId = 'open' | 'copy_link' | 'copy_file' | 'download' | 'phase';
export type DriveFileAction = { id: DriveFileActionId; label: string };

const LABELS: Record<DriveFileActionId, string> = { open: 'Abrir', copy_link: 'Copiar enlace', copy_file: 'Copiar archivo', download: 'Descargar', phase: 'Marcar como antes / después' };
export const DRIVE_LINK_COPIED = 'Enlace copiado';
export const DRIVE_FILE_COPIED = 'Imagen copiada';
export const DRIVE_COPY_FAILED = 'No se pudo copiar. Prueba de nuevo.';
export const DRIVE_PASTE_HINT = 'Pega aquí una imagen o un archivo (Ctrl+V) o arrástralo';
export const DRIVE_PASTE_EMPTY = 'No hay una imagen copiada para pegar.';

/** «Copiar archivo» only for an image: a browser's and Android's clipboard carry images, not PDFs. */
export function driveFileActions(file: Pick<ServiceFile, 'mime' | 'id'>, device: { copiesFiles: boolean }): DriveFileAction[] {
  const image = file.mime.startsWith('image/');
  const copy: DriveFileActionId[] = image && device.copiesFiles ? ['copy_file'] : [];
  const phase: DriveFileActionId[] = image && file.id ? ['phase'] : [];
  const ids: DriveFileActionId[] = ['open', 'copy_link', ...copy, 'download', ...phase];
  return ids.map((id) => ({ id, label: LABELS[id] }));
}

const twoDigits = (value: number) => String(value).padStart(2, '0');
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const GENERIC_NAME = /^image\.(png|jpe?g|gif|webp)$/i;

/** A file pasted with its name keeps it; a screenshot («image.png» or nameless) is named by its time. */
export function pastedDriveName(name: string, mime: string, now: Date): string {
  const given = name.trim();
  if (given && !GENERIC_NAME.test(given)) return given;
  const day = `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}`;
  const time = `${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`;
  return `pegado-${day}-${time}.${EXTENSIONS[mime] ?? 'png'}`;
}
