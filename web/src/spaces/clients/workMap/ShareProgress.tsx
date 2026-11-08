import { useState } from 'react';
import { Check, Copy, Download, Link2, ShieldCheck, X } from 'lucide-react';
import { createProgressLink, createProgressPdf, toggleMapInReport, partialProgressOf, partialStreetsLabel, progressLinkExpiry, shareStageOptions, type MapEditSend, type ProgressLink, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { DayField, PANEL_LABEL, StageField } from './CutFields';
import { PdfAction } from './PdfAction';

type Props = { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; /** Portal's map tools through the door; without it there is nothing to create. */ send?: MapEditSend; onClose: () => void };

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

/** «Incluir en el informe del servicio»: the client's report PDF adds the map at this cut. */
function InReport(props: { map: WorkMap; filter: WorkMapFilter; send: MapEditSend }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const change = async (include: boolean) => {
    setBusy(true);
    const step = await toggleMapInReport(props.send, props.map, props.filter, include);
    setBusy(false);
    if (step.on !== null) setOn(step.on);
    setNote(step.note);
  };
  return (
    <div>
      <PanelSwitch testId="compartir-informe" title="Incluir en el informe del servicio" hint="El PDF del servicio suma una hoja con el mapa de este corte." on={on} disabled={busy} onChange={(include) => void change(include)} />
      {note ? <p role={note.ok ? 'status' : 'alert'} data-testid="compartir-informe-nota" className={`mt-1 text-[12px] ${note.ok ? 'text-on-surface-variant' : 'font-semibold text-error'}`}>{note.text}</p> : null}
    </div>
  );
}

type LinkState = { busy: boolean; link: ProgressLink | null; error: string | null };

/** A switch of the panel with its title and its hint (o-08: «Mostrar fotos», «Incluir en el informe»). */
function PanelSwitch(props: { testId: string; title: string; hint: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span>
        <span className="block text-[14px] font-semibold text-on-surface">{props.title}</span>
        <span className="block text-[12px] text-on-surface-variant">{props.hint}</span>
      </span>
      <input type="checkbox" role="switch" data-testid={props.testId} checked={props.on} disabled={props.disabled} onChange={(event) => props.onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-outline/30 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-surface after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5" />
    </label>
  );
}

/** «Enlace público seguro»: the link Portal made for this cut; the client only sees what was approved. */
function PublicLink(props: { state: LinkState }) {
  const { link, error } = props.state;
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = (url: string) => navigator.clipboard.writeText(url).then(() => setCopied('done'), (failure: Error) => {
    console.warn('work map: copy refused', failure.name);
    setCopied('failed');
  });
  const expiry = link ? progressLinkExpiry(link) : null;
  return (
    <section className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <p className={PANEL_LABEL}>Enlace público seguro</p>
      {link ? (
        <div className="mt-2 flex items-center gap-2">
          <p data-testid="mapa-enlace-cliente" className="min-w-0 flex-1 truncate rounded-lg border border-outline/20 bg-background px-2.5 py-2 font-mono text-[12px] text-on-surface">{link.url}</p>
          <button type="button" data-testid="mapa-copiar-enlace" onClick={() => void copy(link.url)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-[13px] font-semibold text-primary">{copied === 'done' ? <Check size={14} /> : <Copy size={14} />}{copied === 'done' ? 'Copiado' : 'Copiar'}</button>
        </div>
      ) : <p className="mt-2 text-[13px] text-on-surface-variant">Crea el enlace con este corte. El cliente no puede ver más que eso.</p>}
      {expiry ? <p className="mt-1 text-[12px] text-on-surface-variant">{expiry}</p> : null}
      {error ? <p role="alert" data-testid="compartir-error" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
      {copied === 'failed' ? <p role="alert" className="mt-1 text-[12px] text-error">El navegador no dejó copiar. Selecciona el enlace y cópialo.</p> : null}
      <p className="mt-2 flex items-start gap-1.5 text-[12px] text-on-surface-variant"><ShieldCheck size={14} className="mt-px shrink-0 text-primary" />El cliente ve solo lo aprobado por la inspección técnica.</p>
    </section>
  );
}

/** «Compartir avance» (design o-08): the cut of the work, what it shows, and the link the client opens. */
export function ShareProgress(props: Props) {
  const [photos, setPhotos] = useState(false);
  const [state, setState] = useState<LinkState>({ busy: false, link: null, error: null });
  const cut = (filter: WorkMapFilter) => { setState({ busy: false, link: null, error: null }); props.onFilter(filter); };
  const create = async (send: MapEditSend) => {
    setState({ busy: true, link: null, error: null });
    const made = await createProgressLink(send, props.filter, photos);
    setState(made.ok ? { busy: false, link: made.link, error: null } : { busy: false, link: null, error: made.message });
  };
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
        {props.map.stages.length ? <StageField map={props.map} filter={props.filter} onFilter={cut} options={shareStageOptions(props.map)} /> : null}
        <DayField map={props.map} filter={props.filter} onFilter={cut} />
        <FrontSummary map={props.map} filter={props.filter} />
        <PanelSwitch testId="compartir-fotos" title="Mostrar fotos" hint="El cliente ve las fotos de la obra hasta el día del corte." on={photos} onChange={(on) => { setPhotos(on); setState({ busy: false, link: null, error: null }); }} />
        {props.send ? <InReport map={props.map} filter={props.filter} send={props.send} /> : null}
        <PublicLink state={state} />
        {props.send ? <PdfAction key={`${props.filter.stageId ?? ''}|${props.filter.untilDay ?? ''}`} testId="compartir-pdf" label="Descargar PDF para cliente" icon={<Download size={16} />} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-outline/25 bg-surface text-[14px] font-semibold text-on-surface" create={() => createProgressPdf(props.send!, props.filter, 'client')} /> : null}
        {props.send ? <button type="button" data-testid="compartir-crear-enlace" disabled={state.busy} onClick={() => void create(props.send!)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-on-primary disabled:opacity-60"><Link2 size={17} />{state.busy ? 'Creando…' : 'Crear enlace de avance'}</button> : null}
      </div>
    </div>
  );
}
