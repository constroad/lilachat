import type { ReactNode } from 'react';
import { metersLabel, NO_STRETCHES, stageStateLabel, workMapCutChip, workShares, type StageGroup, type WorkMapFilter, type WorkMapStreetRow, type WorkMapView } from '@lilachat/shared';

export const KICKER = 'font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';

/** One color per work under the big figure: together they fill as far as the work went. */
function StackedBar(props: { view: WorkMapView }) {
  return (
    <div data-testid="mapa-barra-trabajos" className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-variant">
      {workShares(props.view).map((share) => <span key={share.workId} className="h-full" style={{ width: `${share.percent}%`, backgroundColor: share.color }} />)}
    </div>
  );
}

function Figure(props: { view: WorkMapView }) {
  const { view } = props;
  if (view.totalM <= 0) return <p className="mt-2 text-[14px] text-on-surface-variant">{NO_STRETCHES}</p>;
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className="text-4xl font-extrabold tabular-nums tracking-tight text-on-surface">{String(view.percent).replace('.', ',')}<span className="text-primary"> %</span></span>
      <span className="text-[13px] text-on-surface-variant">{`${metersLabel(view.doneM)} de ${metersLabel(view.totalM)} avanzados`}</span>
    </p>
  );
}

function PanelHead(props: { view: WorkMapView; groups: StageGroup[]; badge?: ReactNode }) {
  const { groups } = props;
  const lengthM = groups.reduce((sum, group) => sum + group.lengthM, 0);
  const named = groups.filter((group) => group.name);
  return (
    <div className="shrink-0 border-b border-outline/15 bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className={KICKER}>Avance de la obra</p>
        {props.badge}
      </div>
      <div data-testid="mapa-avance" className="flex items-end justify-between gap-3">
        <Figure view={props.view} />
        <div className="shrink-0 pb-1 text-right">
          <p className="text-[11px] text-on-surface-variant">Longitud total</p>
          <p className="font-mono text-[15px] font-semibold tabular-nums text-on-surface">{metersLabel(lengthM)}</p>
        </div>
      </div>
      <StackedBar view={props.view} />
      {named.length > 1 ? (
        <p className="mt-2 flex flex-wrap justify-between gap-x-3 text-[12px] text-on-surface-variant">
          {named.map((group) => <span key={group.id}>{group.name}: <b className="font-semibold text-on-surface">{metersLabel(group.lengthM)}</b></span>)}
        </p>
      ) : null}
    </div>
  );
}

function StreetCard(props: { street: WorkMapStreetRow }) {
  const { street } = props;
  return (
    <li data-testid={`mapa-calle-${street.id}`} className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[14px] font-bold text-on-surface">{street.name}</p>
        <span className="shrink-0 rounded-md border border-outline/20 px-1.5 py-0.5 font-mono text-[12px] font-semibold tabular-nums text-on-surface">{metersLabel(street.lengthM)}</span>
      </div>
      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-surface-variant">
        {street.segments.map((segment) => (
          <span key={`${segment.workId}-${segment.fromPct}`} className="absolute inset-y-0" style={{ left: `${segment.fromPct}%`, width: `${segment.widthPct}%`, backgroundColor: segment.color }} />
        ))}
      </div>
      <p className="mt-3 font-mono text-[12px] text-on-surface-variant">{street.status}</p>
    </li>
  );
}

function GroupTitle(props: { group: StageGroup }) {
  const state = stageStateLabel(props.group);
  const active = state === 'En ejecución';
  const count = props.group.streets.length;
  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-2 pt-4">
      <p className={`flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-outline/50'}`} />
        {props.group.name ? `${props.group.name} · ${state}` : state}
      </p>
      <span className="shrink-0 text-[12px] text-on-surface-variant">{count === 1 ? '1 calle' : `${count} calles`}</span>
    </div>
  );
}

/**
 * The right panel of the map (design `o-01-mapa-obra`): the big figure with the bar by work, then
 * the streets under their stage, and the day the map is cut at. Admins see the units of the
 * Control de pista on top (`o-07`).
 */
export function WorkMapPanel(props: { view: WorkMapView; groups: StageGroup[]; filter: WorkMapFilter; badge?: ReactNode; top?: ReactNode; scrolls: boolean }) {
  return (
    <>
      <PanelHead view={props.view} groups={props.groups} badge={props.badge} />
      <div className={`bg-background px-4 pb-4 md:px-5 ${props.scrolls ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}>
        {props.top ? <div className="pt-4">{props.top}</div> : null}
        {props.groups.map((group) => (
          <section key={group.id}>
            <GroupTitle group={group} />
            <ul className="space-y-3">{group.streets.map((street) => <StreetCard key={street.id} street={street} />)}</ul>
          </section>
        ))}
      </div>
      <p data-testid="mapa-corte-pie" className="shrink-0 border-t border-outline/15 bg-surface px-4 py-2.5 text-right font-mono text-[12px] text-on-surface-variant md:px-5">Corte: {workMapCutChip(props.filter)}</p>
    </>
  );
}
