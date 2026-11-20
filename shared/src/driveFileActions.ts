/**
 * The menu of one file of a service's Drive and of «Medios» (José 19/11, design cc-05): open it,
 * copy its link, copy the file itself, share it, mark a photo before/after and download it. And the name of what is pasted
 * into the Drive (Ctrl+V on a computer, «Pegar del portapapeles» on the APK). PURE: app and web.
 */
import type { MediaLibraryItem } from './mediaLibrary.js';
import { activityWhen } from './serviceFacts.js';
import type { ServiceFile } from './serviceFiles.js';

export type DriveFileActionId = 'open' | 'copy_link' | 'copy_file' | 'share' | 'phase' | 'download';
export type DriveFileAction = { id: DriveFileActionId; label: string; /** A second line under the label (design cc-05 mobile). */ hint?: string };
/** What the device can do, and how «open» reads where the file is not opened in a viewer («Medios» opens its chat). */
export type DriveFileActionOptions = { copiesFiles: boolean; shares?: boolean; openLabel?: string };

const LABELS: Record<DriveFileActionId, string> = { open: 'Abrir vista previa', copy_link: 'Copiar enlace', copy_file: 'Copiar archivo', share: 'Compartir', phase: 'Marcar como antes / después', download: 'Descargar' };
const PHASE_HINT = 'Vincula esta foto al reporte fotográfico';
export const DRIVE_LINK_COPIED = 'Enlace copiado';
export const DRIVE_FILE_COPIED = 'Imagen copiada';
export const DRIVE_COPY_FAILED = 'No se pudo copiar. Prueba de nuevo.';
export const DRIVE_PASTE_HINT = 'Pega aquí una imagen o un archivo (Ctrl+V) o arrástralo';
export const DRIVE_PASTE_EMPTY = 'No hay una imagen copiada para pegar.';
/** «Ver en el chat»: in «Medios» a file is opened at its message. */
export const MEDIA_OPEN_IN_CHAT = 'Ver en el chat';

/**
 * In the order of design cc-05 mobile. «Copiar archivo» only for an image: a browser's and
 * Android's clipboard carry images, not PDFs. «Compartir» where the device has a share sheet.
 * «Marcar como antes / después» only for a photo Portal sent with its id.
 */
export function driveFileActions(file: Pick<ServiceFile, 'mime' | 'id'>, options: DriveFileActionOptions): DriveFileAction[] {
  const image = file.mime.startsWith('image/');
  const ids: DriveFileActionId[] = ['open', 'copy_link'];
  if (image && options.copiesFiles) ids.push('copy_file');
  if (options.shares) ids.push('share');
  if (image && file.id) ids.push('phase');
  ids.push('download');
  return ids.map((id) => ({ id, label: id === 'open' && options.openLabel ? options.openLabel : LABELS[id], ...(id === 'phase' ? { hint: PHASE_HINT } : {}) }));
}

const BYTES_PER_MB = 1_048_576;

/** The head of a file's sheet (design cc-05 mobile): «Hoy 09:40 · Fotos de obra · 1.8 MB», with what exists. */
export function driveSheetLine(file: Pick<ServiceFile, 'modifiedAt' | 'folder' | 'sizeBytes'>, now: Date): string {
  const when = file.modifiedAt && !Number.isNaN(Date.parse(file.modifiedAt)) ? activityWhen(file.modifiedAt, now) : undefined;
  const size = file.sizeBytes !== undefined ? `${(file.sizeBytes / BYTES_PER_MB).toFixed(1)} MB` : undefined;
  return [when, file.folder, size].filter(Boolean).join(' · ');
}

const FALLBACK_MIME: Record<'image' | 'video' | 'file', string> = { image: 'image/jpeg', video: 'video/mp4', file: 'application/octet-stream' };

/** A photo, video or document of «Medios» as a Drive file, so it gets the same sheet; a link or a text has none. */
export function mediaItemAsFile(item: MediaLibraryItem, chatName: string): ServiceFile | null {
  const url = item.media?.url;
  if (item.kind === 'text' || !url) return null;
  return {
    name: item.media?.fileName ?? url.split('/').pop() ?? 'archivo',
    mime: item.media?.mime ?? FALLBACK_MIME[item.kind],
    url,
    folder: chatName,
    modifiedAt: item.at,
    ...(item.media?.thumbUrl ? { thumbUrl: item.media.thumbUrl } : {}),
    ...(item.media?.sizeBytes !== undefined ? { sizeBytes: item.media.sizeBytes } : {}),
  };
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

/** A copy that worked: its floating notice carries the check (José 19/11, design cc-05). */
export const driveNoticeDone = (text: string): boolean => text === DRIVE_LINK_COPIED || text === DRIVE_FILE_COPIED;
