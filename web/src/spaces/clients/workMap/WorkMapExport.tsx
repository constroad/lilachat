import { useState } from 'react';
import { Check, Copy, Download, Folder, FolderOpen, Globe, Link2, X } from 'lucide-react';
import { exportStageOptions, KMZ_MIME, kmzLayersOf, workMapFileName, workMapKml, workMapKmz, workMapScopeLabel, workMapStageFilter, workMapWorkFilter, type WorkMap, type WorkMapFilter } from '@lilachat/shared';
import { DayField, PANEL_LABEL } from './CutFields';

const CARD = 'rounded-xl border-[1.5px] border-outline/15 bg-surface p-4';
const SEGMENT = 'min-h-[40px] rounded-lg border px-3 py-1.5 text-[12px] font-semibold';
const CHIP = 'flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold';
type Props = { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; title: string; pageUrl: string; onClose: () => void };

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

/** «Qué», «Hasta el día» and «Trabajos» (o-12): the map behind follows what is chosen here. */
function WhatLeaves(props: Props) {
  const { map, filter } = props;
  const works = map.works;
  return (
    <section className="space-y-4 rounded-xl border-[1.5px] border-outline/15 bg-background p-4">
      {map.stages.length ? (
        <div>
          <p className={PANEL_LABEL}>Qué</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {exportStageOptions(map).map((option) => {
              const on = (filter.stageId ?? '') === option.id;
              return <button key={option.id || 'all'} type="button" aria-pressed={on} data-testid={`exportar-que-${option.id || 'todo'}`} onClick={() => props.onFilter(workMapStageFilter(map, filter, option.id))} className={`${SEGMENT} ${on ? 'border-primary bg-surface text-primary' : 'border-outline/20 bg-surface text-on-surface'}`}>{option.label}</button>;
            })}
          </div>
        </div>
      ) : null}
      <DayField map={map} filter={filter} onFilter={props.onFilter} />
      {works.length ? (
        <div>
          <div className="flex items-center justify-between"><p className={PANEL_LABEL}>Trabajos</p><button type="button" data-testid="exportar-trabajos-todos" onClick={() => props.onFilter(workMapWorkFilter(filter))} className="text-[12px] font-semibold text-primary">Todos ({works.length})</button></div>
          <div className="mt-1 flex flex-wrap gap-2">
            {works.map((work) => {
              const on = !filter.workId || filter.workId === work.id;
              return <button key={work.id} type="button" aria-pressed={on} data-testid={`exportar-trabajo-${work.id}`} onClick={() => props.onFilter(workMapWorkFilter(filter, filter.workId === work.id ? undefined : work.id))} className={`${CHIP} ${on ? 'border-outline/25 bg-surface text-on-surface' : 'border-outline/10 text-on-surface-variant opacity-60'}`}><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />{work.name}</button>;
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ClientLink(props: { pageUrl: string }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const copy = () => navigator.clipboard.writeText(props.pageUrl).then(() => setCopied('done'), (failure: Error) => {
    console.warn('work map: copy refused', failure.name);
    setCopied('failed');
  });
  return (
    <section className={CARD}>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-on-surface"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Link2 size={16} /></span>Enlace para el cliente</p>
      <p className="mt-1 text-[12px] text-on-surface-variant">Solo lo aprobado.</p>
      <p className="mt-2 truncate rounded-lg border border-outline/20 bg-background px-2.5 py-1.5 font-mono text-[12px] text-on-surface-variant">{props.pageUrl}</p>
      <div className="mt-3 flex justify-end"><button type="button" data-testid="mapa-copiar-enlace-visor" onClick={() => void copy()} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-on-primary">{copied === 'done' ? <Check size={15} /> : <Copy size={15} />}{copied === 'done' ? 'Enlace copiado' : 'Copiar enlace de visor'}</button></div>
      {copied === 'failed' ? <p role="alert" className="mt-1 text-[12px] text-error">El navegador no dejó copiar. Selecciona el enlace y cópialo.</p> : null}
    </section>
  );
}

/** «Estructura de capas KMZ generada»: the folders Google Earth will show, with their metres. */
function KmzTree(props: { map: WorkMap; filter: WorkMapFilter; fileName: string }) {
  const layers = kmzLayersOf(props.map, props.filter);
  return (
    <section data-testid="exportar-capas" className="rounded-xl bg-on-surface p-4 font-mono text-[12px] text-surface">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface/70">Estructura de capas KMZ generada</p>
      <p className="mt-2 flex items-center gap-1.5"><FolderOpen size={14} />{props.fileName.replace(/\.kmz$/, '')}/</p>
      <p className="ml-4 mt-1 flex items-center gap-1.5 text-primary-container"><Folder size={14} />Ejecutado/</p>
      {layers.done.map((layer) => <p key={layer.workId} className="ml-9 flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: layer.color }} />{layer.name} ({layer.meters})</p>)}
      <p className="ml-4 mt-1 flex items-center gap-1.5 text-surface/80"><Folder size={14} />Pendiente ({layers.pending})</p>
    </section>
  );
}

/** «Exportar» (design o-12): what leaves the map, to Google Earth and to the client. */
export function WorkMapExport(props: Props) {
  const fileName = workMapFileName(props.title, props.filter, new Date());
  return (
    <div data-testid="mapa-exportar-panel" className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Sacar la obra</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-on-surface">Exportar</p>
          <p data-testid="mapa-exportar-alcance" className="mt-0.5 text-[13px] text-on-surface-variant">Genera los entregables georreferenciados: {workMapScopeLabel(props.map, props.filter)}.</p>
        </div>
        <button type="button" data-testid="mapa-exportar-cerrar" aria-label="Cerrar exportar" onClick={props.onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline/20 text-on-surface"><X size={16} /></button>
      </div>
      <div className="mt-5 space-y-4">
        <WhatLeaves {...props} />
        <p className={PANEL_LABEL}>Formatos de exportación</p>
        <section className={CARD}>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-on-surface"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Globe size={16} /></span>Google Earth (KMZ)</p>
          <p className="mt-1 text-[12px] text-on-surface-variant">Carpetas Ejecutado, por trabajo, y Pendiente.</p>
          <p data-testid="exportar-archivo" className="mt-2 truncate rounded-lg border border-outline/20 bg-background px-2.5 py-1.5 font-mono text-[12px] text-on-surface-variant">{fileName}</p>
          <div className="mt-3 flex justify-end"><button type="button" data-testid="mapa-descargar-kmz" onClick={() => saveKmz(props.map, props.filter, props.title)} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-on-primary"><Download size={15} />Descargar KMZ</button></div>
        </section>
        <ClientLink pageUrl={props.pageUrl} />
        <KmzTree map={props.map} filter={props.filter} fileName={fileName} />
      </div>
    </div>
  );
}
