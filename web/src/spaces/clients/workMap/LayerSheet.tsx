import type { ReactNode } from 'react';
import { ChevronUp, Pencil } from 'lucide-react';
import { LAYER_LEGEND, layerBarOf, layerStreetsToggle, type LayerLatest, type LayerStreetSummary, type LayerSummary } from '@lilachat/shared';

/** A colour dot ringed so a near-black layer still reads on the dark theme (José 28/11). */
export const LAYER_DOT = 'h-2.5 w-2.5 shrink-0 rounded-full ring-[1.5px] ring-on-surface/40';

/** What is done, solid from the left (design ma01; José 28/11: nothing waits for approval). */
function LayerBar(props: { row: Pick<LayerStreetSummary, 'donePct' | 'pendingPct'>; color: string; tall?: boolean }) {
  const bar = layerBarOf(props.row);
  return (
    <div className={`relative overflow-hidden rounded-full bg-surface-variant ${props.tall ? 'h-3' : 'h-2'}`}>
      <span className="absolute inset-y-0 left-0" style={{ width: bar.done, backgroundColor: props.color }} />
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
    <p data-testid="capa-ultimo" className="text-[13px] text-on-surface-variant">{props.latest.text}</p>
  );
}

/** «Hecho» in the layer's colour, «Pendiente de ejecución» in the map's orange, no dashes (José 28/11). */
function Legend(props: { color: string }) {
  return (
    <p data-testid="capa-leyenda" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
      <span aria-hidden className="h-1.5 w-5 rounded-full ring-1 ring-on-surface/40" style={{ backgroundColor: props.color }} />{LAYER_LEGEND.done}
      <span aria-hidden>·</span>
      <span aria-hidden className="h-1.5 w-5 rounded-full ring-1 ring-on-surface/40" style={{ backgroundColor: LAYER_LEGEND.plannedColor }} />{LAYER_LEGEND.planned}
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
    <div data-testid="mapa-capa-hoja" className={expanded ? 'space-y-4' : 'space-y-2.5'}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 truncate text-[12px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
          <span aria-hidden className={LAYER_DOT} style={{ backgroundColor: summary.color }} />{summary.kicker}
        </p>
        {expanded ? props.badge : null}
      </div>
      <div data-testid="mapa-avance" className="space-y-2">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className={`${expanded ? 'text-[22px]' : 'text-[18px]'} font-extrabold tabular-nums tracking-tight text-on-surface`}>{summary.headline}</span>
          {summary.streets.length ? <span className={`${expanded ? 'text-[30px]' : 'text-[22px]'} font-extrabold tabular-nums text-on-surface`}>{summary.percentText}</span> : null}
        </p>
        <LayerBar row={summary} color={summary.color} tall={expanded} />
        {expanded && summary.widthNote ? <p data-testid="capa-sin-ancho" className="text-[12px] text-on-surface-variant">{summary.widthNote}</p> : null}
      </div>
      {expanded && props.onExpand && summary.streets.length ? (
        <button type="button" data-testid="capa-ver-calles" aria-expanded onClick={props.onExpand} className="flex h-9 items-center gap-1 text-[14px] font-semibold text-primary">
          {layerStreetsToggle(summary.streets.length, true)}<ChevronUp size={16} />
        </button>
      ) : null}
      {expanded && summary.streets.length ? <ul className="space-y-2">{summary.streets.map((row) => <StreetRow key={row.streetId} row={row} color={summary.color} />)}</ul> : null}
      {expanded ? <Legend color={summary.color} /> : null}
      {expanded && props.latest ? <Latest latest={props.latest} /> : null}
      {props.onRecord ? <RecordLayerButton label={summary.recordLabel} onClick={props.onRecord} /> : null}
    </div>
  );
}

/** «Registrar avance de <capa>»: the sheet's ONE action (52 px, primary); alone when the sheet is folded. */
export const RecordLayerButton = (props: { label: string; onClick: () => void }) => (
  <button type="button" data-testid="capa-registrar" onClick={props.onClick} className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-[16px] font-bold text-on-primary hover:opacity-90">
    <Pencil size={18} className="shrink-0" />{props.label}
  </button>
);
