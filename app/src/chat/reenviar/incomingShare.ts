import { MAXIMO_DE_FOTOS } from '../envioDeFotos';

/**
 * What another app hands over with «Compartir» (José, 02/11: YouTube, Instagram,
 * TikTok and Facebook did not list Lilachat), as the native `share-into` module
 * reads it from Android's SEND / SEND_MULTIPLE. PURE engine.
 *
 * Everything in it is UNTRUSTED: any app on the phone can send it.
 */
export type IncomingShare = {
  text?: string | null;
  subject?: string | null;
  files?: readonly { uri?: string | null; mimeType?: string | null; name?: string | null; size?: number | null }[] | null;
};

/** A shared file, ready for the file queue (`encolarArchivo`). */
export type SharedFile = { uri: string; mimeType: string; fileName: string; sizeBytes: number; caption?: string };

/** `text`: sent as a message; with files it rides as the first one's caption instead. */
export type SharePlan = { text: string | null; files: SharedFile[]; summary: string };

export const MAX_SHARED_TEXT = 4000;
const MAX_NAME = 120;
const SUMMARY_CHARS = 80;
const FALLBACK_MIME = 'application/octet-stream';

export function planIncomingShare(share: IncomingShare | null | undefined): SharePlan | null {
  if (!share) return null;
  const files = sharedFiles(share.files);
  const text = sharedText(share, files.length > 0);
  if (!text && files.length === 0) return null;
  // With files the text is the first one's caption, as in WhatsApp.
  const [first, ...rest] = files;
  const withCaption = text && first ? [{ ...first, caption: text }, ...rest] : files;
  return { text: files.length ? null : text, files: withCaption, summary: shareSummary(text, files) };
}

/** A link from YouTube comes with its title as subject: the link is what is sent, as WhatsApp does. */
function sharedText(share: IncomingShare, hasFiles: boolean): string | null {
  const text = share.text?.trim() ?? '';
  const chosen = text || (hasFiles ? '' : (share.subject?.trim() ?? ''));
  return chosen ? chosen.slice(0, MAX_SHARED_TEXT) : null;
}

/** Only `content://`: a `file://` could point at this app's own private files and upload them. */
function sharedFiles(raw: IncomingShare['files']): SharedFile[] {
  return (raw ?? [])
    .filter((file): file is { uri: string; mimeType?: string | null; name?: string | null; size?: number | null } => typeof file?.uri === 'string' && file.uri.startsWith('content://'))
    .slice(0, MAXIMO_DE_FOTOS)
    .map((file) => {
      const mimeType = file.mimeType?.includes('/') ? file.mimeType.toLowerCase() : FALLBACK_MIME;
      const size = Number(file.size);
      return { uri: file.uri, mimeType, fileName: safeName(file.name, mimeType), sizeBytes: Number.isFinite(size) && size > 0 ? Math.round(size) : 0 };
    });
}

/** The last path segment, never a path; with no name, one from its type. */
function safeName(name: string | null | undefined, mimeType: string): string {
  const base = (name ?? '').split(/[\\/]/).pop()?.trim().slice(0, MAX_NAME) ?? '';
  if (base && base !== '.' && base !== '..') return base;
  const subtype = mimeType.split('/')[1]?.replace(/[^a-z0-9]/g, '') ?? '';
  return subtype && mimeType !== FALLBACK_MIME ? `compartido.${subtype === 'jpeg' ? 'jpg' : subtype}` : 'compartido';
}

/** What the picker says it is sharing: «3 fotos», «1 video», «2 archivos», or the text's first line. */
function shareSummary(text: string | null, files: readonly SharedFile[]): string {
  if (files.length === 0) {
    const line = text?.split('\n')[0] ?? '';
    return line.length > SUMMARY_CHARS ? `${line.slice(0, SUMMARY_CHARS)}…` : line;
  }
  const count = files.length;
  if (files.every((file) => file.mimeType.startsWith('image/'))) return count === 1 ? '1 foto' : `${count} fotos`;
  if (files.every((file) => file.mimeType.startsWith('video/'))) return count === 1 ? '1 video' : `${count} videos`;
  return count === 1 ? '1 archivo' : `${count} archivos`;
}
