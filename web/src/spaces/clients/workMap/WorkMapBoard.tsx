import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { metersLabel, workMapHeadline, workMapStageFilter, workMapView, type WorkMap, type WorkMapFilter, type WorkMapStreetRow, type WorkMapView } from '@lilachat/shared';

const WorkMapCanvas = lazy(() => import('./WorkMapCanvas'));

const CHIP = 'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold';
const CHIP_ON = 'border-primary bg-primary text-on-primary';
const CHIP_OFF = 'border-outline/20 bg-surface text-on-surface';
const ICON_BUTTON = 'flex h-9 items-center gap-1.5 rounded-xl border border-outline/20 px-3 text-[13px] font-semibold text-on-surface';

/** The browser's full screen when it allows it; the layer over the page stands either way. */
function useFullScreen() {
  const holder = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    const followBrowser = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('fullscreenchange', followBrowser);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('fullscreenchange', followBrowser);
    };
  }, [expanded]);
  const open = () => {
    setExpanded(true);
    holder.current?.requestFullscreen?.().catch((failure: Error) => console.warn('work map: full screen refused', failure.name));
  };
  const close = () => {
    setExpanded(false);
    if (document.fullscreenElement) void document.exitFullscreen();
  };
  return { holder, expanded, open, close };
}

function ProgressBar(props: { percent: number }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-variant">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, props.percent)}%` }} />
    </div>
  );
}

function StreetRow(props: { street: WorkMapStreetRow }) {
  const { street } = props;
  return (
    <li data-testid={`mapa-calle-${street.id}`} className="rounded-xl border border-outline/15 bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[14px] font-semibold text-on-surface">{street.name}</p>
        <span className="shrink-0 font-mono text-[12px] text-on-surface-variant">{metersLabel(street.lengthM)}</span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-surface-variant">
        {street.segments.map((segment) => (
          <span key={`${segment.workId}-${segment.fromPct}`} className="absolute inset-y-0" style={{ left: `${segment.fromPct}%`, width: `${segment.widthPct}%`, backgroundColor: segment.color }} />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-on-surface-variant">{street.status}</p>
    </li>
  );
}

function WorkChips(props: { view: WorkMapView; workId?: string; onPick: (workId?: string) => void }) {
  if (!props.view.works.length) return null;
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      <button type="button" data-testid="mapa-trabajo-todos" aria-pressed={!props.workId} onClick={() => props.onPick()} className={`${CHIP} ${props.workId ? CHIP_OFF : CHIP_ON}`}>Todos</button>
      {props.view.works.map((work) => (
        <button key={work.id} type="button" data-testid={`mapa-trabajo-${work.id}`} aria-pressed={props.workId === work.id} onClick={() => props.onPick(work.id)} className={`${CHIP} ${props.workId === work.id ? CHIP_ON : CHIP_OFF}`}>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />
          {work.name} {work.percent} %
        </button>
      ))}
    </div>
  );
}

function Legend(props: { view: WorkMapView }) {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[70%] flex-wrap gap-x-3 gap-y-1 rounded-lg bg-surface/95 px-2.5 py-1.5 text-[11px] font-medium text-on-surface shadow-sm">
      {props.view.works.map((work) => (
        <span key={work.id} className="flex items-center gap-1"><span aria-hidden className="h-1 w-3.5 rounded-full" style={{ backgroundColor: work.color }} />{work.name}</span>
      ))}
      <span className="text-on-surface-variant">Punteado: por ejecutar</span>
    </div>
  );
}

function Header(props: { view: WorkMapView; pageUrl: string; stages: ReactNode; expanded: boolean; onToggle: () => void }) {
  const { view } = props;
  return (
    <header className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Mapa de la obra</p>
        <p data-testid="mapa-avance" className="text-[15px] font-semibold text-on-surface">{workMapHeadline(view)}</p>
      </div>
      {props.stages}
      <button type="button" data-testid="mapa-pantalla-completa" onClick={props.onToggle} className={ICON_BUTTON}>
        {props.expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {props.expanded ? 'Salir' : 'Pantalla completa'}
      </button>
      <a data-testid="mapa-abrir" href={props.pageUrl} target="_blank" rel="noopener noreferrer" className={ICON_BUTTON}><ExternalLink size={15} /> Portal</a>
    </header>
  );
}

/** The map, its figures and its streets (design `o-01-mapa-obra`), read only. */
export function WorkMapBoard(props: { map: WorkMap; pageUrl: string }) {
  const { map, pageUrl } = props;
  const [filter, setFilter] = useState<WorkMapFilter>({});
  const view = useMemo(() => workMapView(map, filter), [map, filter]);
  const { holder, expanded, open, close } = useFullScreen();
  const stages = map.stages.length ? (
    <select data-testid="mapa-etapa" aria-label="Etapa" value={filter.stageId ?? ''} onChange={(event) => setFilter(workMapStageFilter(map, filter, event.target.value))} className="h-9 rounded-xl border border-outline/20 bg-surface px-2 text-[13px] font-semibold text-on-surface">
      <option value="">Todas las etapas</option>
      {map.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
    </select>
  ) : null;
  return (
    <div ref={holder} data-testid="mapa-servicio" data-expanded={expanded} className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-surface p-3' : 'rounded-2xl border border-outline/15 bg-surface p-3'}>
      <Header view={view} pageUrl={pageUrl} stages={stages} expanded={expanded} onToggle={expanded ? close : open} />
      <WorkChips view={view} workId={filter.workId} onPick={(workId) => setFilter({ ...(filter.stageId ? { stageId: filter.stageId } : {}), ...(workId ? { workId } : {}) })} />
      <div className={expanded ? 'mt-2 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,38%)] gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1' : 'mt-2 space-y-3'}>
        <div className={`relative overflow-hidden rounded-xl border border-outline/15 bg-surface-variant ${expanded ? 'min-h-0' : 'h-[420px]'}`}>
          <Suspense fallback={<div data-testid="mapa-cargando-lienzo" className="absolute inset-0 animate-pulse bg-surface-variant" />}>
            <WorkMapCanvas view={view} expanded={expanded} />
          </Suspense>
          <Legend view={view} />
        </div>
        <aside className={expanded ? 'min-h-0 overflow-y-auto' : ''}>
          <ProgressBar percent={view.percent} />
          <ul className="mt-3 space-y-2">{view.streets.map((street) => <StreetRow key={street.id} street={street} />)}</ul>
        </aside>
      </div>
    </div>
  );
}
