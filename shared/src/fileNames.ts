/**
 * A file's name as the person sent it (José 17/11: a chat's file downloads with its own name). The picker or the
 * storage sometimes escaped it («Cotizacion%20(1).pdf»): it is decoded, and what breaks a path (`/`, `\`, line
 * breaks) becomes a space. PURE.
 */
export function readableFileName(name: string | undefined): string {
  let readable = name ?? '';
  try {
    readable = decodeURIComponent(readable);
  } catch {
    // A stray «%» that is not an escape: the name stays as it came.
  }
  return readable.replace(/[/\\\n\r\t]+/g, ' ').replace(/ {2,}/g, ' ').trim() || 'archivo';
}

/** Our files live under `/media/` (lila's under `/files/`), on our host or a local one in an E2E. */
const OWN_MEDIA = /^(https?:\/\/[^/]+)?\/media\//;

/**
 * The link that downloads a chat's file with its own name (José 17/11): our files (`/media/`) answer
 * `?download=<name>` with `Content-Disposition: attachment`. A file on another host stays as it is.
 */
export function downloadUrlOf(url: string, name: string | undefined): string {
  if (!OWN_MEDIA.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(readableFileName(name))}`;
}
