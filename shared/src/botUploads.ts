/**
 * What agentes may upload for a channel (José 17/11: a prospect's KML, photo or PDF with metrados): photos,
 * videos and the documents of a quote, up to 16 MB. A generic type is decided by the extension. PURE.
 */
export const BOT_UPLOAD_MAX_BYTES = 16 * 1024 * 1024;
export const BOT_UPLOADS_PER_POST = 10;
export type BotUploadKind = 'image' | 'video' | 'audio' | 'file';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'kml', 'kmz', 'xlsx', 'xls', 'docx', 'doc', 'dwg', 'dxf', 'csv']);
/** A WhatsApp voice note (agentes 23/11): ogg/opus, m4a or mp3, however the parameters after `;` read. */
const AUDIO_TYPES = new Set(['audio/ogg', 'audio/mp4', 'audio/mpeg']);
const UPLOAD_ID = /^[0-9a-f]{24}$/;

export function botUploadKindOf(mime: string, name: string): BotUploadKind | null {
  const extension = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '';
  if (mime.startsWith('image/') && IMAGE_EXTENSIONS.has(extension || mime.slice('image/'.length))) return 'image';
  if (mime === 'video/mp4') return 'video';
  if (AUDIO_TYPES.has(mime.split(';')[0]!.trim())) return 'audio';
  return DOCUMENT_EXTENSIONS.has(extension) ? 'file' : null;
}

/** The longest voice note a bot may describe, and the waveform's bars (José 27/11: a bot's audio showed 0:00 and a flat line). */
export const BOT_AUDIO_MAX_MS = 15 * 60 * 1000;
export const BOT_WAVEFORM_BARS = { min: 16, max: 64 } as const;

/** One `{ file_id }` of a post; an audio may say how long it is and how it looks, drawn like a member's voice note. */
export type BotUploadRef = { fileId: string; durationMs?: number; /** Bars of 0 to 100, like a member's `media.onda`. */ onda?: number[] };
const FILES_SHAPE = `files va como hasta ${BOT_UPLOADS_PER_POST} { file_id } de POST /api/bots/files.`;
type RefResult = { ok: true; ref: BotUploadRef } | { ok: false; message: string };

const isDurationMs = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0 && (value as number) <= BOT_AUDIO_MAX_MS;
const isBotWaveform = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length >= BOT_WAVEFORM_BARS.min && value.length <= BOT_WAVEFORM_BARS.max && value.every((bar) => typeof bar === 'number' && Number.isFinite(bar) && bar >= 0 && bar <= 1);

/** `duration_ms` and `waveform` (0..1) of one file, checked; the waveform becomes the 0..100 bars a voice note draws. */
function uploadRefOf(raw: unknown): RefResult {
  const item = raw && typeof raw === 'object' ? (raw as { file_id?: unknown; duration_ms?: unknown; waveform?: unknown }) : {};
  if (typeof item.file_id !== 'string' || !UPLOAD_ID.test(item.file_id)) return { ok: false, message: FILES_SHAPE };
  if (item.duration_ms !== undefined && !isDurationMs(item.duration_ms)) return { ok: false, message: `duration_ms va en milisegundos, un entero mayor que 0 y hasta ${BOT_AUDIO_MAX_MS} (15 min).` };
  if (item.waveform !== undefined && !isBotWaveform(item.waveform)) return { ok: false, message: `waveform va como ${BOT_WAVEFORM_BARS.min} a ${BOT_WAVEFORM_BARS.max} números de 0 a 1.` };
  const onda = isBotWaveform(item.waveform) ? { onda: item.waveform.map((bar) => Math.round(bar * 100)) } : {};
  return { ok: true, ref: { fileId: item.file_id, ...(isDurationMs(item.duration_ms) ? { durationMs: item.duration_ms } : {}), ...onda } };
}

/** `files: [{ file_id, duration_ms?, waveform? }]` in a post: the earlier uploads; null when `files` is a gallery of urls. */
export function uploadIdsOf(raw: unknown): { ok: true; refs: BotUploadRef[] } | { ok: false; message: string } | null {
  if (!Array.isArray(raw) || !raw.some((item) => item && typeof item === 'object' && 'file_id' in item)) return null;
  if (raw.length > BOT_UPLOADS_PER_POST) return { ok: false, message: FILES_SHAPE };
  const refs: BotUploadRef[] = [];
  for (const item of raw) {
    const checked = uploadRefOf(item);
    if (!checked.ok) return checked;
    refs.push(checked.ref);
  }
  return { ok: true, refs };
}
