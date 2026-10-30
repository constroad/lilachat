import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import type { DetailSheet, SheetFact, SheetMedia, ViewableFile } from '@lilachat/shared';
import { FileThumb } from './PortalFileViewer';
import { Overlay } from '../../ui/Overlay';
import { DETAIL_TONE } from './tones';

/** A report with no PDF stored: asked to Portal on click (agentes 30/10); ready, its link replaces the button. */
export type PdfOnDemandWeb = { asking: boolean; message: string | null; readyUrl: string | null; onAsk: () => void };
const PDF_BUTTON = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary';

function AskPdf({ pdf }: { pdf: PdfOnDemandWeb }) {
  if (pdf.readyUrl) return <a href={pdf.readyUrl} target="_blank" rel="noreferrer" data-testid="abrir-pdf-ficha" className={PDF_BUTTON}><FileText size={16} /> Abrir el PDF</a>;
  return (
    <>
      <button type="button" data-testid="pedir-pdf-ficha" disabled={pdf.asking} onClick={pdf.onAsk} className={`${PDF_BUTTON} disabled:opacity-70`}>
        {pdf.asking ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} {pdf.asking ? 'Generando el PDF…' : 'Ver el PDF'}
      </button>
      {pdf.message ? <p data-testid="pdf-ficha-fallo" role="alert" className="text-sm text-error">{pdf.message}</p> : null}
    </>
  );
}

const Kicker = ({ children }: { children: string }) => <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{children}</p>;

/** Opens a file in Lilachat's viewer; `siblings` swipe in the gallery. */
export type OpenSheetFile = (file: ViewableFile, siblings?: readonly ViewableFile[]) => void;

const Facts = ({ facts }: { facts: SheetFact[] }) => (
  <dl className="divide-y divide-outline/10 rounded-xl border border-outline/15 bg-surface px-4">
    {facts.map((fact) => <div key={fact.label} className="flex justify-between gap-3 py-2.5 text-sm"><dt className="text-on-surface-variant">{fact.label}</dt><dd className="text-right font-semibold">{fact.value}</dd></div>)}
  </dl>
);

/** A dispatch's photos and videos (José 30/10 night: «no veo las fotos y videos»), opened in the viewer. */
function MediaStrip({ media, onOpen }: { media: SheetMedia[]; onOpen: OpenSheetFile }) {
  return (
    <>
      <Kicker>{`Fotos y videos · ${media.length}`}</Kicker>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {media.map((one, index) => (
          <button key={one.url} type="button" data-testid={`media-ficha-${index}`} aria-label={one.name} onClick={() => onOpen(one, media)} className="overflow-hidden rounded-lg">
            <FileThumb file={one} size={72} />
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * An order, dispatch, report or quote inside Lilachat (José 30/10: sending him
 * to Portal for every detail was not useful): its facts, its file straight
 * from lila (no Portal session), an order's dispatches and a quote's line
 * items. Portal stays at the foot, secondary.
 */
export function RecordSheetWeb({ sheet, onClose, pdf, onOpenFile }: { sheet: DetailSheet; onClose: () => void; pdf?: PdfOnDemandWeb; onOpenFile: OpenSheetFile }) {
  return (
    <Overlay title={sheet.title} onClose={onClose}>
      <div data-testid="ficha-registro" className="flex flex-col gap-3">
        <span className={`self-start rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${DETAIL_TONE[sheet.status.tone]}`}>{sheet.status.label}</span>
        {sheet.facts.length ? <Facts facts={sheet.facts} /> : null}
        {sheet.groups.map((group) => <div key={group.title} data-testid={`grupo-${group.title}`} className="flex flex-col gap-2"><Kicker>{group.title}</Kicker><Facts facts={group.facts} /></div>)}
        {sheet.media.length ? <MediaStrip media={sheet.media} onOpen={onOpenFile} /> : null}
        {sheet.files.map((file, index) => <button key={file.url} type="button" onClick={() => onOpenFile({ url: file.url, name: `${sheet.title} · ${file.label}` })} data-testid={index ? `ver-archivo-ficha-${index}` : 'ver-archivo-ficha'} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary"><FileText size={16} /> {file.label === 'PDF' ? 'Ver el PDF' : `Ver ${file.label}`}</button>)}
        {sheet.pdfOnDemand && pdf ? <AskPdf pdf={pdf} /> : null}
        {sheet.note ? <p data-testid="nota-ficha" className="text-sm text-on-surface-variant">{sheet.note}</p> : null}
        {sheet.items.length ? (
          <>
            <Kicker>Partidas</Kicker>
            <ul className="divide-y divide-outline/10 rounded-xl border border-outline/15 bg-surface px-4">
              {sheet.items.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-start gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p>{item.line ? <p className="text-[12px] text-on-surface-variant">{item.line}</p> : null}</div>{item.total ? <span className="text-sm font-semibold tabular-nums">{item.total}</span> : null}</li>)}
            </ul>
          </>
        ) : null}
        {sheet.related.length ? (
          <>
            <Kicker>Despachos de este pedido</Kicker>
            <ul className="divide-y divide-outline/10 rounded-xl border border-outline/15 bg-surface px-4">
              {sheet.related.map((row) => (
                <li key={row.id} data-testid={`relacionado-${row.id}`} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{row.title}</p>{row.line ? <p className="truncate text-[12px] text-on-surface-variant">{row.line}</p> : null}</div>
                  {row.file ? <button type="button" onClick={() => row.file && onOpenFile({ url: row.file.url, name: `${row.title} · ${row.file.label}` })} className="text-[12px] font-semibold text-primary hover:underline">{row.file.label}</button> : null}
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {sheet.url ? <a href={sheet.url} target="_blank" rel="noreferrer" data-testid="ficha-en-portal" className="inline-flex items-center gap-1.5 text-[13px] text-on-surface-variant hover:underline"><ExternalLink size={14} /> Abrir en el Portal</a> : null}
      </div>
    </Overlay>
  );
}
