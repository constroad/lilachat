/**
 * What agentes may upload for a channel (José 17/11: a prospect's KML, photo or PDF with metrados): photos,
 * videos and the documents of a quote, up to 16 MB. A generic type is decided by the extension. PURE.
 */
export const BOT_UPLOAD_MAX_BYTES = 16 * 1024 * 1024;
export const BOT_UPLOADS_PER_POST = 10;
export type BotUploadKind = 'image' | 'video' | 'file';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'kml', 'kmz', 'xlsx', 'xls', 'docx', 'doc', 'dwg', 'dxf', 'csv']);
const UPLOAD_ID = /^[0-9a-f]{24}$/;

export function botUploadKindOf(mime: string, name: string): BotUploadKind | null {
  const extension = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '';
  if (mime.startsWith('image/') && IMAGE_EXTENSIONS.has(extension || mime.slice('image/'.length))) return 'image';
  if (mime === 'video/mp4') return 'video';
  return DOCUMENT_EXTENSIONS.has(extension) ? 'file' : null;
}

/** `files: [{ file_id }]` in a post: the ids of earlier uploads; null when `files` is a gallery of urls. */
export function uploadIdsOf(raw: unknown): { ok: true; ids: string[] } | { ok: false; message: string } | null {
  if (!Array.isArray(raw) || !raw.some((item) => item && typeof item === 'object' && 'file_id' in item)) return null;
  const ids = raw.map((item) => (item && typeof item === 'object' ? (item as { file_id?: unknown }).file_id : undefined));
  const valid = ids.length <= BOT_UPLOADS_PER_POST && ids.every((id): id is string => typeof id === 'string' && UPLOAD_ID.test(id));
  return valid ? { ok: true, ids } : { ok: false, message: `files va como hasta ${BOT_UPLOADS_PER_POST} { file_id } de POST /api/bots/files.` };
}
