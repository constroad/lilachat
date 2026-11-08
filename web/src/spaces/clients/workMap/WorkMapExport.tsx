import { useState } from 'react';
import { Check, Copy, Download, Globe, Link2, X } from 'lucide-react';
import { KMZ_MIME, partialProgressOf, partialStreetsLabel, workMapFileName, workMapKml, workMapKmz, workMapScopeLabel, type WorkMap, type WorkMapFilter } from '@lilachat/shared';

const CARD = 'rounded-xl border border-outline/15 bg-surface p-3';
const PRIMARY = 'mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-on-primary';
const SECONDARY = 'mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-primary/30 text-[14px] font-semibold text-primary';

/** The browser saves the bytes with the work's name; the link is gone once the click took it. */
function saveKmz(map: WorkMap, filter: WorkMapFilter, title: string): void {
  const bytes = workMapKmz(workMapKml(map, filter, title));
  const url = URL.createObjectURL(new Blob([bytes], { type: KMZ_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = workMapFileName(title, filter, new Date());
  link.click();
  URL.revokeObjectURL(url);
}

function ClientLink(props: { pageUrl: string }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = () => {
    navigator.clipboard.writeText(props.pageUrl).then(() => setCopied('done'), (failure: Error) => {
      console.warn('work map: copy refused', failure.name);
      setCopied('failed');
    });
  };
  return (
    <section className={CARD}>
      <p className="flex items-center gap-2 text-[14px] font-semibold text-on-surface"><Link2 size={16} /> Enlace para el cliente</p>
      <p className="mt-0.5 text-[12px] text-on-surface-variant">El cliente solo ve lo aprobado.</p>
      <p data-testid="mapa-enlace-cliente" className="mt-2 truncate rounded-lg bg-surface-variant px-2 py-1.5 font-mono text-[12px] text-on-surface-variant">{props.pageUrl}</p>
      <button type="button" data-testid="mapa-copiar-enlace" onClick={copy} className={SECONDARY}>
        {copied === 'done' ? <Check size={16} /> : <Copy size={16} />} {copied === 'done' ? 'Enlace copiado' : 'Copiar enlace'}
      </button>
      {copied === 'failed' ? <p role="alert" className="mt-1 text-[12px] text-error">El navegador no dejó copiar. Selecciona el enlace y cópialo.</p> : null}
    </section>
  );
}

/** «Avance parcial» (o-08): which streets each work covered, for the stage and day the map shows. */
function PartialProgress(props: { map: WorkMap; filter: WorkMapFilter }) {
  const summary = partialProgressOf(props.map, props.filter);
  return (
    <section data-testid="mapa-avance-parcial" className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-on-surface">Avance parcial</p>
        <span data-testid="mapa-parcial-vias" className="font-mono text-[12px] font-semibold text-primary">{partialStreetsLabel(summary)}</span>
      </div>
      {summary.rows.length ? (
        <ul className="mt-2 space-y-1.5">
          {summary.rows.map((row) => <li key={row.workId} data-testid={`mapa-parcial-${row.workId}`} className="flex items-start gap-2 text-[13px] text-on-surface"><span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} /><span><b>{row.name}:</b> {row.streets}</span></li>)}
        </ul>
      ) : <p className="mt-2 text-[13px] text-on-surface-variant">Todavía no hay avance aprobado en este corte.</p>}
      <div className="mt-3 flex items-baseline justify-between border-t border-outline/15 pt-2">
        <span className="text-[12px] text-on-surface-variant">Metrado aprobado acumulado</span>
        <span data-testid="mapa-parcial-metrado" className="font-mono text-[15px] font-bold text-primary">{summary.doneLabel}</span>
      </div>
    </section>
  );
}

/** «Exportar» of the map (design `o-12-mapa-exportar`): what the map shows, to Google Earth and to the client. */
export function WorkMapExport(props: { map: WorkMap; filter: WorkMapFilter; title: string; pageUrl: string; onClose: () => void }) {
  return (
    <div data-testid="mapa-exportar-panel" className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-2 border-b border-outline/15 pb-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Sacar la obra</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-on-surface">Exportar</p>
          <p data-testid="mapa-exportar-alcance" className="mt-0.5 text-[12px] text-on-surface-variant">Sale lo que ves: {workMapScopeLabel(props.map, props.filter)}</p>
        </div>
        <button type="button" data-testid="mapa-exportar-cerrar" aria-label="Cerrar exportar" onClick={props.onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline/20 text-on-surface"><X size={16} /></button>
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
        <PartialProgress map={props.map} filter={props.filter} />
        <section className={CARD}>
          <p className="flex items-center gap-2 text-[14px] font-semibold text-on-surface"><Globe size={16} /> Google Earth (KMZ)</p>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">Carpetas Ejecutado, por trabajo, y Pendiente.</p>
          <button type="button" data-testid="mapa-descargar-kmz" onClick={() => saveKmz(props.map, props.filter, props.title)} className={PRIMARY}><Download size={16} /> Descargar KMZ</button>
        </section>
        <ClientLink pageUrl={props.pageUrl} />
      </div>
    </div>
  );
}
