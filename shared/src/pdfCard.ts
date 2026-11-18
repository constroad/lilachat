import { formatBytes } from './media.js';

/**
 * A PDF in the chat (José 17/11): the server draws its first page and counts its pages; the card shows the page
 * and «3 páginas · 255 KB · PDF» under the name, like WhatsApp. PURE, shared by the web and the APK.
 */
type PdfMediaLike = { mime?: string; fileName?: string };

export const isPdfMedia = (media: PdfMediaLike): boolean => media.mime === 'application/pdf' || /\.pdf$/i.test(media.fileName ?? '');

export function pdfCardLineOf(media: { pages?: number; sizeBytes?: number }): string {
  const pages = media.pages ? `${media.pages} ${media.pages === 1 ? 'página' : 'páginas'}` : null;
  const size = media.sizeBytes !== undefined ? formatBytes(media.sizeBytes) : null;
  return [pages, size, 'PDF'].filter(Boolean).join(' · ');
}
