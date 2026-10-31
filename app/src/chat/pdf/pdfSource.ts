import { PDF_READINESS_TEXT, type PdfReadiness } from '@lilachat/shared';

/**
 * Which messages open in the PDF viewer and how its failures read (pending 7).
 * PURE.
 */
export type ChatPdf = { seq: number; url: string; name: string; at: string; mime: string };

type MessageLike = { seq: number; at: string; deletedAt?: string | null; media?: { url?: string; mime?: string; fileName?: string } | null };

export const isPdf = (mime: string | undefined): boolean => mime === 'application/pdf';

/** The chat's PDFs, newest first, for the viewer and its «Compartido en el chat» strip. */
export function chatPdfs(messages: readonly MessageLike[]): ChatPdf[] {
  const pdfs: ChatPdf[] = [];
  for (const message of messages) {
    const media = message.media;
    if (message.deletedAt || !media?.url || !isPdf(media.mime) || message.seq <= 0) continue;
    pdfs.push({ seq: message.seq, url: media.url, name: media.fileName?.trim() || 'Documento PDF', at: message.at, mime: 'application/pdf' });
  }
  return pdfs.sort((a, b) => b.seq - a.seq);
}

const HASH_SEED = 5381;
const HASH_SHIFT = 5;
const HASH_RADIX = 36;

/**
 * The working copy: one per FILE, so reopening it does not download again.
 * By URL and not by `seq`: a seq repeats in every chat, and the copy of
 * chat A's message 12 opened as chat B's (found 30/10).
 */
export function pdfCacheName(url: string): string {
  let hash = HASH_SEED;
  for (let index = 0; index < url.length; index += 1) hash = ((hash << HASH_SHIFT) + hash + url.charCodeAt(index)) >>> 0;
  return `pdf-view-${hash.toString(HASH_RADIX)}-${url.length.toString(HASH_RADIX)}.pdf`;
}

export type PdfFailure = 'protected' | 'download' | 'damaged' | 'generating' | 'expired' | 'missing';

const FAILURE_CODES: Record<string, PdfFailure> = { ERR_PDF_PROTECTED: 'protected', ERR_PDF_DOWNLOAD: 'download', ERR_PDF_GENERATING: 'generating', ERR_PDF_EXPIRED: 'expired', ERR_PDF_MISSING: 'missing' };

/** A failure as the screen says it, from the renderer's code or the download. */
export function pdfFailureFrom(error: unknown): PdfFailure {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  return FAILURE_CODES[code] ?? 'damaged';
}

/** The code a download that did not bring the PDF throws (quote-pdf, Portal f09e3dc1); null when it came. */
export function pdfDownloadCodeOf(readiness: PdfReadiness): string | null {
  if (readiness === 'ready') return null;
  if (readiness === 'failed') return 'ERR_PDF_DOWNLOAD';
  return `ERR_PDF_${readiness.toUpperCase()}`;
}

export const PDF_FAILURE_TEXT: Record<PdfFailure, string> = {
  protected: 'Este PDF tiene contraseña. Ábrelo con otra app para escribirla.',
  download: 'No se pudo descargar el PDF. Revisa tu conexión y prueba de nuevo.',
  damaged: 'No se pudo mostrar este PDF aquí. Prueba abrirlo con otra app.',
  ...PDF_READINESS_TEXT,
};
