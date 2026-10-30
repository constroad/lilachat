import { ExternalLink, FileText } from 'lucide-react';
import type { DetailSheet } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';
import { DETAIL_TONE } from './tones';

const Kicker = ({ children }: { children: string }) => <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{children}</p>;

/**
 * A pedido, despacho, informe or cotización inside Lilachat (José 30/10: «me
 * dice que abra Portal… no me parece muy útil»): its facts, its file straight
 * from lila (no Portal session), an order's dispatches and a quote's line
 * items. Portal stays at the foot, secondary.
 */
export function RecordSheetWeb({ sheet, onClose }: { sheet: DetailSheet; onClose: () => void }) {
  return (
    <Overlay title={sheet.title} onClose={onClose}>
      <div data-testid="ficha-registro" className="flex flex-col gap-3">
        <span className={`self-start rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${DETAIL_TONE[sheet.status.tone]}`}>{sheet.status.label}</span>
        {sheet.facts.length ? (
          <dl className="divide-y divide-outline/10 rounded-xl border border-outline/15 bg-surface px-4">
            {sheet.facts.map((fact) => <div key={fact.label} className="flex justify-between gap-3 py-2.5 text-sm"><dt className="text-on-surface-variant">{fact.label}</dt><dd className="text-right font-semibold">{fact.value}</dd></div>)}
          </dl>
        ) : null}
        {sheet.file ? <a href={sheet.file.url} target="_blank" rel="noreferrer" data-testid="ver-archivo-ficha" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary"><FileText size={16} /> {sheet.file.label === 'PDF' ? 'Ver el PDF' : 'Ver la guía'}</a> : null}
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
                  {row.file ? <a href={row.file.url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-primary hover:underline">{row.file.label}</a> : null}
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
