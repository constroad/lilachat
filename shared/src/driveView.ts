import { limaDayKey } from './birthdays.js';
import { DRIVE_VIDEO_SECONDS } from './driveUpload.js';
import { instantDayOf } from './serviceDetail.js';
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
