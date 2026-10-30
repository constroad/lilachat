/**
 * Portal's files inside Lilachat (José 30/10: «por qué no usamos el visor
 * para ver las imágenes, videos y PDF sin tener que abrir Portal»): Drive,
 * vouchers, guides and report PDFs. agentes confirmed the links are lila's
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
