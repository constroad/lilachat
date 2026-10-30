import { compareNames } from './compareText.js';
import { instantDayOf } from './serviceDetail.js';
/**
 * The Drive of a client's service, on demand (pending 121, design f-06):
 * agentes answers `client.files.requested` with the files Portal keeps for
 * that service. Nothing is stored in Lilachat. PURE: server, app and web.
 */
export type ServiceFile = { name: string; mime: string; url: string; sizeBytes?: number; thumbUrl?: string; folder?: string; modifiedAt?: string };
export type ServiceFiles = { files: ServiceFile[]; driveUrl: string | null };

export const SERVICE_FILES_MAX = 200;
const SEARCH_MIN = 2;
const FOLDER_SEPARATOR = '/';

const isHttps = (value: unknown): value is string => typeof value === 'string' && value.startsWith('https://');
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

function fileOf(raw: unknown): ServiceFile | null {
  const input = raw as Record<string, unknown> | null;
  const name = text(input?.name);
  if (!input || !name || !isHttps(input.url)) return null;
  const sizeBytes = typeof input.size_bytes === 'number' && input.size_bytes >= 0 ? input.size_bytes : undefined;
  return {
    name,
    mime: text(input.mime) ?? 'application/octet-stream',
    url: input.url,
    ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    ...(isHttps(input.thumb_url) ? { thumbUrl: input.thumb_url } : {}),
    ...(text(input.folder) ? { folder: text(input.folder) } : {}),
    ...(text(input.modified_at) ? { modifiedAt: text(input.modified_at) } : {}),
  };
}

/** agentes' 200 body, validated: only https files, at most 200, newest first as they come. `null` if it is not that shape. */
export function serviceFilesOf(body: unknown): ServiceFiles | null {
  const input = body as { files?: unknown; drive_url?: unknown } | null;
  if (!input || !Array.isArray(input.files)) return null;
  const files = input.files.map(fileOf).filter((one): one is ServiceFile => one !== null).slice(0, SERVICE_FILES_MAX);
  return { files, driveUrl: isHttps(input.drive_url) ? input.drive_url : null };
}

const topFolderOf = (file: ServiceFile) => file.folder?.split(FOLDER_SEPARATOR)[0]?.trim() || null;

/** «Carpetas principales»: the first level of each path, with how many files hang from it. */
export function driveFolders(files: readonly ServiceFile[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    const top = topFolderOf(file);
    if (top) counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => compareNames(a.name, b.name));
}

/** The files under a top folder (sub-folders included); `null` = the loose ones. */
export const filesInFolder = (files: readonly ServiceFile[], folder: string | null): ServiceFile[] => files.filter((file) => topFolderOf(file) === folder);

const plain = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Search by name or folder path, accents and case aside; under two letters nothing is filtered. */
export function searchServiceFiles(files: readonly ServiceFile[], query: string): ServiceFile[] {
  const term = plain(query.trim());
  if (term.length < SEARCH_MIN) return [...files];
  return files.filter((file) => plain(`${file.name} ${file.folder ?? ''}`).includes(term));
}

const BYTES_PER_MB = 1_048_576;

/** The second line of a Drive file: «Informes · 2.4 MB · 21 oct», the day as it was in Lima. */
export const driveFileLine = (file: ServiceFile): string =>
  [file.folder, file.sizeBytes !== undefined ? `${(file.sizeBytes / BYTES_PER_MB).toFixed(1)} MB` : undefined, file.modifiedAt && !Number.isNaN(Date.parse(file.modifiedAt)) ? instantDayOf(file.modifiedAt) : undefined].filter(Boolean).join(' · ');
