import { parseMediaSecret, type MediaSecret } from '@lilachat/shared';

/**
 * A secret chat's photo or video (pending 67 / F12.3, José 29/10), as the
 * bubble draws it. The server keeps an encrypted file with no name or shape;
 * the opened text of the message says what it is and holds its key. Until the
 * phone decrypts it, the bubble shows its shape and «opening». PURE.
 */
export const UNREADABLE = '🔒 No se pudo descifrar';

export type SecretFile = { uri?: string; failed?: boolean };
type WithMedia = { body?: string; media?: { url?: string; thumbUrl?: string; mime?: string; fileName?: string; sizeBytes?: number; width?: number; height?: number; durationMs?: number; sealed?: 'opening' | 'failed' } };

/** The message with its opened text: plain words, or the decrypted photo or video once it is on the phone. */
export function withOpenedText<M extends WithMedia>(message: M, text: string | null, fileOf: (url: string, secret: MediaSecret) => SecretFile): M {
  if (text === null) return { ...message, body: UNREADABLE };
  const secret = parseMediaSecret(text);
  const url = message.media?.url;
  if (!secret) return { ...message, body: text };
  // A file's secret with no file (deleted, or broken): never its key on the screen.
  if (!url) return { ...message, body: UNREADABLE };
  const file = fileOf(url, secret);
  return {
    ...message,
    body: secret.caption,
    media: {
      ...message.media,
      mime: secret.mime,
      fileName: secret.fileName,
      sizeBytes: secret.sizeBytes,
      width: secret.width,
      height: secret.height,
      durationMs: secret.durationMs,
      url: file.uri,
      // A video's thumbnail cannot be the video itself: the bubble draws its dark frame with the play.
      thumbUrl: secret.mime.startsWith('image/') ? file.uri : undefined,
      sealed: file.uri ? undefined : file.failed ? 'failed' : 'opening',
    },
  };
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/3gpp': '.3gp',
  'audio/mp4': '.m4a', 'audio/m4a': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/webm': '.webm', 'audio/3gpp': '.3gp',
  'application/pdf': '.pdf', 'application/zip': '.zip', 'text/plain': '.txt',
  'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const fallbackExtension = (mime: string) => (mime.startsWith('video/') ? '.mp4' : mime.startsWith('audio/') ? '.m4a' : mime.startsWith('image/') ? '.jpg' : '.bin');

/** The name of the decrypted copy: one per stored file, with the extension the viewer needs to play it. */
export function openedFileName(url: string, mime: string): string | null {
  const last = (url.split(/[?#]/)[0] ?? '').split('/').filter(Boolean).pop();
  if (!last) return null;
  const base = last.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^A-Za-z0-9_-]/g, '_');
  return `${base}${EXTENSIONS[mime.toLowerCase()] ?? fallbackExtension(mime)}`;
}
