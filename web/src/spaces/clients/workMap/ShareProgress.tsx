import { useState } from 'react';
import { Check, Copy, ShieldCheck, X } from 'lucide-react';
import { partialProgressOf, partialStreetsLabel, shareStageOptions, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { DayField, PANEL_LABEL, StageField } from './CutFields';

type Props = { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; pageUrl: string; onClose: () => void };

/** «Resumen de frente»: which streets each work covered at this cut, and the approved metres. */
function FrontSummary(props: { map: WorkMap; filter: WorkMapFilter }) {
  const summary = partialProgressOf(props.map, props.filter);
  return (
    <section data-testid="mapa-avance-parcial" className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className={PANEL_LABEL}>Resumen de frente</p>
        <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Aprobado</span>
      </div>
      {summary.rows.length ? (
        <ul className="mt-3 space-y-2">
          {summary.rows.map((row) => <li key={row.workId} data-testid={`mapa-parcial-${row.workId}`} className="flex items-start gap-2 text-[13px] text-on-surface"><span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} /><span><b>{row.name}:</b> {row.streets}</span></li>)}
        </ul>
      ) : <p className="mt-3 text-[13px] text-on-surface-variant">Todavía no hay avance aprobado en este corte.</p>}
      <p data-testid="mapa-parcial-vias" className="mt-2 font-mono text-[12px] text-primary">{partialStreetsLabel(summary)}</p>
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-outline/15 pt-3">
        <span className="text-[12px] text-on-surface-variant">Metrado aprobado acumulado:</span>
        <span data-testid="mapa-parcial-metrado" className="font-mono text-[22px] font-bold leading-tight text-primary">{summary.doneLabel}</span>
      </div>
    </section>
  );
}

/** «Enlace público seguro»: Portal's page of the service; the client only sees what was approved. */
function PublicLink(props: { pageUrl: string }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = () => navigator.clipboard.writeText(props.pageUrl).then(() => setCopied('done'), (failure: Error) => {
    console.warn('work map: copy refused', failure.name);
    setCopied('failed');
  });
  return (
    <section className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <p className={PANEL_LABEL}>Enlace público seguro</p>
      <div className="mt-2 flex items-center gap-2">
        <p data-testid="mapa-enlace-cliente" className="min-w-0 flex-1 truncate rounded-lg border border-outline/20 bg-background px-2.5 py-2 font-mono text-[12px] text-on-surface">{props.pageUrl}</p>
        <button type="button" data-testid="mapa-copiar-enlace" onClick={() => void copy()} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-[13px] font-semibold text-primary">{copied === 'done' ? <Check size={14} /> : <Copy size={14} />}{copied === 'done' ? 'Copiado' : 'Copiar'}</button>
      </div>
      {copied === 'failed' ? <p role="alert" className="mt-1 text-[12px] text-error">El navegador no dejó copiar. Selecciona el enlace y cópialo.</p> : null}
      <p className="mt-2 flex items-start gap-1.5 text-[12px] text-on-surface-variant"><ShieldCheck size={14} className="mt-px shrink-0 text-primary" />El cliente ve solo lo aprobado por la inspección técnica.</p>
    </section>
  );
}

/** «Compartir avance» (design o-08): the cut of the work, what it shows, and the link the client opens. */
export function ShareProgress(props: Props) {
  return (
    <div data-testid="mapa-compartir-panel" className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Compartir avance</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-on-surface">Avance parcial</p>
          <p className="mt-0.5 text-[13px] text-on-surface-variant">Elige el corte de obra para generar el enlace que verá el cliente.</p>
        </div>
        <button type="button" data-testid="mapa-compartir-cerrar" aria-label="Cerrar compartir avance" onClick={props.onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline/20 text-on-surface"><X size={16} /></button>
      </div>
      <div className="mt-5 space-y-4">
        {props.map.stages.length ? <StageField map={props.map} filter={props.filter} onFilter={props.onFilter} options={shareStageOptions(props.map)} /> : null}
        <DayField map={props.map} filter={props.filter} onFilter={props.onFilter} />
        <FrontSummary map={props.map} filter={props.filter} />
        <PublicLink pageUrl={props.pageUrl} />
      </div>
    </div>
  );
}
