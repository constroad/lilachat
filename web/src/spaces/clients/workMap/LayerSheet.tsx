import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { LAYER_LEGEND, layerBarOf, layerStreetsToggle, type LayerLatest, type LayerStreetSummary, type LayerSummary } from '@lilachat/shared';

/** What waits for approval, hatched in the layer's colour (the colour is data, as on the map). */
const hatchOf = (color: string) => `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 7px)`;

/** Approved solid from the left, what waits hatched right after it (design ma01). */
function LayerBar(props: { row: Pick<LayerStreetSummary, 'donePct' | 'pendingPct'>; color: string; tall?: boolean }) {
  const bar = layerBarOf(props.row);
  return (
    <div className={`relative overflow-hidden rounded-full bg-surface-variant ${props.tall ? 'h-3' : 'h-2'}`}>
      <span className="absolute inset-y-0 left-0" style={{ width: bar.done, backgroundColor: props.color }} />
      {props.row.pendingPct > 0 ? <span data-testid="capa-por-aprobar" className="absolute inset-y-0 opacity-70" style={{ left: bar.pendingLeft, width: bar.pending, backgroundImage: hatchOf(props.color) }} /> : null}
    </div>
  );
}

function StreetRow(props: { row: LayerStreetSummary; color: string }) {
  const { row } = props;
  return (
    <li data-testid={`capa-calle-${row.streetId}`} className="space-y-2 rounded-2xl bg-surface-variant/60 px-4 py-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[15px] font-semibold text-on-surface">{row.name}</span>
        <span className="font-mono text-[13px] tabular-nums text-on-surface-variant">{row.amount} <b className="ml-1 text-on-surface">{row.percentText}</b></span>
      </p>
      <LayerBar row={row} color={props.color} />
    </li>
  );
}

function Latest(props: { latest: LayerLatest }) {
  return (
    <p data-testid="capa-ultimo" className="flex flex-wrap items-center gap-2 text-[13px] text-on-surface-variant">
      {props.latest.text}
      {props.latest.pill ? <span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-bold uppercase text-warning">{props.latest.pill}</span> : null}
    </p>
  );
}

/** «— Hecho · - - Planificado» in the layer's colour (design ma01). */
function Legend(props: { color: string }) {
  return (
    <p data-testid="capa-leyenda" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
      <span aria-hidden className="h-1 w-5 rounded-full" style={{ backgroundColor: props.color }} />{LAYER_LEGEND.done}
      <span aria-hidden>·</span>
      <span aria-hidden className="w-5 border-t-[3px] border-dashed" style={{ borderColor: props.color }} />{LAYER_LEGEND.planned}
    </p>
  );
}

type SheetProps = { summary: LayerSummary; latest: LayerLatest | null; badge?: ReactNode; onRecord?: () => void; /** The phone's peek (José 28/11): figure, bar and the action; the streets on demand. */ expanded?: boolean; onExpand?: () => void };

/**
 * The sheet of the active layer (design ma01, José 28/11): its figure, one row per street with its
 * bar, the legend, the latest progress and ONE «Registrar avance de <capa>». On a phone it opens as
 * a peek and grows to the streets.
 */
export function LayerSheet(props: SheetProps) {
  const { summary } = props;
  const expanded = props.expanded ?? true;
  return (
    <div data-testid="mapa-capa-hoja" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: summary.color }} />{summary.kicker}
        </p>
        {props.badge}
      </div>
      <div data-testid="mapa-avance" className="space-y-3">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-[22px] font-extrabold tabular-nums tracking-tight text-on-surface">{summary.headline}</span>
          {summary.streets.length ? <span className="text-[30px] font-extrabold tabular-nums text-on-surface">{summary.percentText}</span> : null}
        </p>
        <LayerBar row={summary} color={summary.color} tall />
        {summary.widthNote ? <p data-testid="capa-sin-ancho" className="text-[12px] text-on-surface-variant">{summary.widthNote}</p> : null}
      </div>
      {props.onExpand && summary.streets.length ? (
        <button type="button" data-testid="capa-ver-calles" aria-expanded={expanded} onClick={props.onExpand} className="flex h-9 items-center gap-1 text-[14px] font-semibold text-primary">
          {layerStreetsToggle(summary.streets.length, expanded)}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      ) : null}
      {expanded && summary.streets.length ? <ul className="space-y-2">{summary.streets.map((row) => <StreetRow key={row.streetId} row={row} color={summary.color} />)}</ul> : null}
      {expanded ? <Legend color={summary.color} /> : null}
      {expanded && props.latest ? <Latest latest={props.latest} /> : null}
      {props.onRecord ? (
        <button type="button" data-testid="capa-registrar" onClick={props.onRecord} className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-[16px] font-bold text-on-primary hover:opacity-90">
          <Pencil size={18} className="shrink-0" />{summary.recordLabel}
        </button>
      ) : null}
    </div>
  );
}
