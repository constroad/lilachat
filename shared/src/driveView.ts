import { limaDayKey } from './birthdays.js';
import { DRIVE_VIDEO_SECONDS } from './driveUpload.js';
import { instantDayOf } from './serviceDetail.js';
import { activityWhen } from './serviceFacts.js';
import type { ServiceFile } from './serviceFiles.js';

/**
 * How the Drive of a service is seen (José 13/11, designs drv-01/02/03): a list or a grid, the
 * chips Todo · Fotos · Videos · Documentos, and ONE «Subir» whose menu has the four ways in.
 * PURE: app and web.
 */
export type DriveKind = 'all' | 'photo' | 'video' | 'document';
export type DriveLayout = 'list' | 'grid';
export type DriveUploadOption = { id: 'photo' | 'video' | 'gallery' | 'document'; title: string; detail: string };
export type DriveDayGroup = { key: string; label: string; files: ServiceFile[] };

const SECONDS_PER_MINUTE = 60;
const NO_DATE = 'Sin fecha';

export const DRIVE_KINDS: readonly { kind: DriveKind; label: string }[] = [
  { kind: 'all', label: 'Todo' },
  { kind: 'photo', label: 'Fotos' },
  { kind: 'video', label: 'Videos' },
  { kind: 'document', label: 'Documentos' },
];

const videoLimit = (seconds: number) => (seconds % SECONDS_PER_MINUTE === 0 ? `${seconds / SECONDS_PER_MINUTE} min` : `${seconds} s`);

export const DRIVE_UPLOAD_OPTIONS: readonly DriveUploadOption[] = [
  { id: 'photo', title: 'Tomar foto', detail: 'Con fecha, hora y lugar' },
  { id: 'video', title: 'Grabar video', detail: `Hasta ${videoLimit(DRIVE_VIDEO_SECONDS)}, con fecha, hora y lugar` },
  { id: 'gallery', title: 'Desde la galería', detail: 'Fotos y videos que ya tienes' },
  { id: 'document', title: 'Documento', detail: 'PDF, Word, Excel o PowerPoint' },
];

export const driveKindOf = (mime: string): Exclude<DriveKind, 'all'> => (mime.startsWith('image/') ? 'photo' : mime.startsWith('video/') ? 'video' : 'document');

export const filesOfKind = (files: readonly ServiceFile[], kind: DriveKind): ServiceFile[] => (kind === 'all' ? [...files] : files.filter((file) => driveKindOf(file.mime) === kind));

const dayKeyOf = (file: ServiceFile): string | null => (file.modifiedAt && !Number.isNaN(Date.parse(file.modifiedAt)) ? limaDayKey(new Date(file.modifiedAt)) : null);

/** The grid by day in Lima, newest day first («Hoy · 13 nov»), the files with no date at the end. */
export function driveDayGroups(files: readonly ServiceFile[], now: Date): DriveDayGroup[] {
  const today = limaDayKey(now);
  const groups = new Map<string, DriveDayGroup>();
  for (const file of files) {
    const key = dayKeyOf(file) ?? NO_DATE;
    const label = key === NO_DATE ? NO_DATE : `${key === today ? 'Hoy · ' : ''}${instantDayOf(file.modifiedAt!)}`;
    const group = groups.get(key) ?? groups.set(key, { key, label, files: [] }).get(key)!;
    group.files.push(file);
  }
  // ISO day keys sort as plain strings: no collator (Hermes builds one per localeCompare).
  const rank = (key: string) => (key === NO_DATE ? '' : key);
  return [...groups.values()].sort((a, b) => (rank(a.key) < rank(b.key) ? 1 : rank(a.key) > rank(b.key) ? -1 : 0));
}

const TAG_MAX = 4;
const KIND_TAGS: Record<Exclude<DriveKind, 'all'>, string> = { photo: 'FOTO', video: 'VIDEO', document: 'DOC' };
const BYTES_PER_MB = 1_048_576;

/** The tag on a tile (design cc-05): JPG, MP4, PDF, XLSX, DOCX; without an extension, its kind. */
export function driveTypeTag(file: Pick<ServiceFile, 'name' | 'mime'>): string {
  const dot = file.name.lastIndexOf('.');
  const extension = dot > 0 ? file.name.slice(dot + 1).trim() : '';
  return extension ? extension.toUpperCase().slice(0, TAG_MAX) : KIND_TAGS[driveKindOf(file.mime)];
}

/** The line under a tile's name (design cc-05): «hoy 08:30 · 2.1 MB», «12 nov · 14.2 MB», with what exists. */
export function driveTileLine(file: Pick<ServiceFile, 'modifiedAt' | 'sizeBytes'>, now: Date): string {
  const when = file.modifiedAt && !Number.isNaN(Date.parse(file.modifiedAt)) ? activityWhen(file.modifiedAt, now) : undefined;
  const size = file.sizeBytes !== undefined ? `${(file.sizeBytes / BYTES_PER_MB).toFixed(1)} MB` : undefined;
  return [when && when.charAt(0).toLowerCase() + when.slice(1), size].filter(Boolean).join(' · ');
}

/** «41 archivos» under a folder card (design cc-05). */
export const driveFilesLabel = (count: number): string => (count === 1 ? '1 archivo' : `${count} archivos`);
