import { FileText } from 'lucide-react';
import { downloadUrlOf, pdfCardLineOf, readableFileName } from '@lilachat/shared';

type PdfMedia = { url: string; thumbUrl?: string; fileName?: string; sizeBytes?: number; pages?: number };

/**
 * A PDF in the chat (José 17/11: «no se muestra el preview o thumbnail en pdf»): its first page on top, then the name
 * and «3 páginas · 255 KB · PDF», like WhatsApp. It opens the chat's PDF viewer, or downloads it where there is none.
 */
export function PdfCardWeb({ media, testId, onOpen }: { media: PdfMedia; testId: string; onOpen?: () => void }) {
  const name = readableFileName(media.fileName) || 'Documento PDF';
  const body = (
    <>
      {media.thumbUrl ? (
        <img data-testid={`${testId}-pagina`} src={media.thumbUrl} alt={`Primera página de ${name}`} loading="lazy" className="block max-h-44 w-full bg-white object-cover object-top" />
      ) : null}
      <span className="flex items-center gap-2 px-2.5 py-2">
        <FileText size={20} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{name}</span>
          <span className="block text-[12px] text-on-surface-variant">{pdfCardLineOf(media)}</span>
        </span>
      </span>
    </>
  );
  const frame = 'mb-1 block w-full max-w-[300px] overflow-hidden rounded-lg border border-outline/15 bg-surface text-left';
  return onOpen ? (
    <button type="button" data-testid={testId} onClick={onOpen} className={frame}>{body}</button>
  ) : (
    <a data-testid={testId} href={downloadUrlOf(media.url, media.fileName)} download={name} target="_blank" rel="noreferrer" className={frame}>{body}</a>
  );
}
