import { FileText } from 'lucide-react';
import { downloadUrlOf, pdfCardLineOf, readableFileName } from '@lilachat/shared';

type PdfMedia = { url: string; thumbUrl?: string; fileName?: string; sizeBytes?: number; pages?: number };

/**
 * A PDF in the chat (José 17/11: «no se muestra el preview o thumbnail en pdf»): its first page on top, then the name
 * and «3 páginas · 255 KB · PDF», like WhatsApp. It opens the chat's PDF viewer, or downloads it where there is none.
 */
export function PdfCardWeb({ media, testId, onOpen }: { media: PdfMedia; testId: string; onOpen?: () => void }) {
  const name = readableFileName(media.fileName) || 'Documento PDF';
  // José 25/11 (WhatsApp beside it): a short strip of the first page flush on top, then a darker panel with the name in
  // regular weight; no card inside the bubble, no border, no icon when there is a page to show.
  const body = (
    <>
      {media.thumbUrl ? (
        <img data-testid={`${testId}-pagina`} src={media.thumbUrl} alt={`Primera página de ${name}`} loading="lazy" className="block h-28 w-full rounded-t-lg bg-white object-cover object-top" />
      ) : null}
      <span className={`flex items-center gap-2 bg-black/10 px-2.5 py-2 dark:bg-black/20 ${media.thumbUrl ? 'rounded-b-lg' : 'rounded-lg'}`}>
        {media.thumbUrl ? null : <FileText size={22} className="shrink-0 opacity-80" />}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-all text-[14px] leading-[18px]">{name}</span>
          <span className="mt-0.5 block text-[12px] opacity-70">{pdfCardLineOf(media)}</span>
        </span>
      </span>
    </>
  );
  const frame = '-mx-1 mb-1 block w-[calc(100%+0.5rem)] min-w-[220px] max-w-[300px] text-left';
  return onOpen ? (
    <button type="button" data-testid={testId} onClick={onOpen} className={frame}>{body}</button>
  ) : (
    <a data-testid={testId} href={downloadUrlOf(media.url, media.fileName)} download={name} target="_blank" rel="noreferrer" className={frame}>{body}</a>
  );
}
