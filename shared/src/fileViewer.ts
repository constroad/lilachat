import { dayAndTimeOf } from './serviceDetail.js';

/**
 * Portal's files inside Lilachat (José 30/10: photos, videos and PDFs should
 * open in Lilachat's viewer, not in Portal): Drive, vouchers, guides and
 * report PDFs. agentes confirmed the links are lila's
 * files, open without a Portal session and accept Range. PURE.
 */
export type ViewableFile = { url: string; name: string; mime?: string; thumbUrl?: string; when?: string };
export type FileOpening = 'gallery' | 'pdf' | 'other';

const UNKNOWN_MIME = 'application/octet-stream';
const EXTENSION_MIMES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pdf: 'application/pdf',
};

const extensionOf = (url: string) => /\.([a-z0-9]+)$/i.exec(url.split(/[?#]/)[0] ?? '')?.[1]?.toLowerCase();

/** The file's mime, or the one its link's extension says when Portal sent none. */
export function mimeOf(file: ViewableFile): string {
  if (file.mime && file.mime !== UNKNOWN_MIME) return file.mime;
  return EXTENSION_MIMES[extensionOf(file.url) ?? ''] ?? UNKNOWN_MIME;
}

export function openingOf(mime: string): FileOpening {
  if (mime.startsWith('image/') || mime.startsWith('video/')) return 'gallery';
  return mime === 'application/pdf' ? 'pdf' : 'other';
}

/** What swipes in the gallery: the photos and videos among the files, in their order. */
export const galleryOf = (files: readonly ViewableFile[]): ViewableFile[] => files.filter((file) => openingOf(mimeOf(file)) === 'gallery');

export const pdfsOf = (files: readonly ViewableFile[]): ViewableFile[] => files.filter((file) => openingOf(mimeOf(file)) === 'pdf');

const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T/;

/** The line under a photo in the viewer: an ISO moment (a dispatch's departure) as «10 set, 1:57 a. m.»; a ready label as it came. */
export function viewerWhenOf(when: string | undefined): string {
  if (!when) return '';
  if (!ISO_MOMENT.test(when)) return when;
  return Number.isNaN(Date.parse(when)) ? '' : dayAndTimeOf(when);
}

/**
 * A Portal PDF that may still be generating (quote-pdf, Portal f09e3dc1): 202
 * is «generating, ask again» after `Retry-After` (the route already waited 6 s);
 * 401 is an expired token, 404/409 a quote without a document.
 */
export type PdfReadiness = 'ready' | 'generating' | 'expired' | 'missing' | 'failed';
const HTTP_OK = 200;
const HTTP_PARTIAL = 206;
const HTTP_ACCEPTED = 202;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
export function pdfReadinessOf(status: number): PdfReadiness {
  if (status === HTTP_OK || status === HTTP_PARTIAL) return 'ready';
  if (status === HTTP_ACCEPTED) return 'generating';
  if (status === HTTP_UNAUTHORIZED) return 'expired';
  return status === HTTP_NOT_FOUND || status === HTTP_CONFLICT ? 'missing' : 'failed';
}

const RETRY_DEFAULT_S = 5;
const RETRY_MAX_S = 10;
const MS_PER_S = 1000;
export const retryAfterMsOf = (header: string | null | undefined): number => {
  const seconds = Number(header);
  return MS_PER_S * (header && Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, RETRY_MAX_S) : RETRY_DEFAULT_S);
};

/** About a minute and a half with the route's own 6 s per try; then it is still «generating». */
export const PDF_GENERATING_TRIES = 6;
type PdfAnswer = { status: number; retryAfter?: string | null };

/** Asks until the PDF is there, waiting what Portal says between tries. */
export async function untilPdfReady(ask: () => Promise<PdfAnswer>, wait: (ms: number) => Promise<void>, tries = PDF_GENERATING_TRIES): Promise<PdfReadiness> {
  for (let attempt = 1; ; attempt += 1) {
    const answer = await ask();
    const readiness = pdfReadinessOf(answer.status);
    if (readiness !== 'generating' || attempt >= tries) return readiness;
    await wait(retryAfterMsOf(answer.retryAfter));
  }
}

/** What the viewer says when the PDF did not come; «failed» is the download's own message. */
export const PDF_READINESS_TEXT: Record<'generating' | 'expired' | 'missing', string> = {
  generating: 'El Portal sigue preparando el PDF. Prueba de nuevo en un minuto.',
  expired: 'El enlace del PDF venció. Vuelve a abrirlo desde el servicio.',
  missing: 'Este PDF no existe o todavía no se generó en el Portal.',
};
