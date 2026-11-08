import { useRef, useState } from 'react';
import { Paintbrush, X } from 'lucide-react';
import { BRUSH_NO_EDIT as NO_EDIT, createdOrRefusal, paintAt, percentLabel, sendWorkScope, sendWorkStage, sendWorkTag, stageCardsOf, undoStroke, WORK_TAG_COLORS, workRowsOf, workStageRequest, workTagRequest, type Brush, type BrushStroke, type MapEditSend, type StageCard, type WorkMap, type WorkMapPoint, type WorkRow } from '@lilachat/shared';
import { NewLabel } from './ScopeForm';
import { KICKER } from './WorkMapPanel';

export type LayersKind = 'stages' | 'works';
type Props = { map: WorkMap; kind: LayersKind; send: MapEditSend; brush: Brush | null; onBrush: (brush: Brush | null) => void; onClose: () => void };

const BRUSH_BUTTON = 'flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold';
const brushClass = (on: boolean) => `${BRUSH_BUTTON} ${on ? 'border-primary bg-primary text-on-primary' : 'border-primary/30 text-primary'}`;
const same = (brush: Brush | null, kind: Brush['kind'], id: string) => brush?.kind === kind && brush.id === id;

function StageCardView(props: { card: StageCard; on: boolean; onBrush: () => void }) {
  const { card } = props;
  return (
    <li data-testid={`etapa-${card.id}`} className={`rounded-xl border-[1.5px] bg-surface p-4 ${props.on ? 'border-primary' : 'border-outline/15'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-on-surface">{card.name}</p>
          <p className="mt-0.5 font-mono text-[12px] text-on-surface-variant">{card.line}</p>
        </div>
        <p className="shrink-0 text-right text-[22px] font-extrabold tabular-nums text-primary">{percentLabel(card.percent)}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-outline/15"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, card.percent)}%` }} /></div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-outline/10 pt-3">
        <p className="text-[12px] text-on-surface-variant">{card.days}</p>
        <button type="button" data-testid={`etapa-brocha-${card.id}`} aria-pressed={props.on} onClick={props.onBrush} className={brushClass(props.on)}><Paintbrush size={14} />{props.on ? 'Tocando calles' : 'Tocar calles'}</button>
      </div>
      {card.streets.length ? <div className="mt-2 flex flex-wrap gap-1.5">{card.streets.map((street) => <span key={street.id} className="rounded-md border border-outline/20 px-2 py-0.5 text-[12px] text-on-surface">{street.name}</span>)}</div> : null}
    </li>
  );
}

function Stages(props: Omit<Props, 'kind' | 'onClose'>) {
  const { cards, loose } = stageCardsOf(props.map);
  return (
    <>
      <ul className="mt-4 space-y-3">{cards.map((card) => <StageCardView key={card.id} card={card} on={same(props.brush, 'stage', card.id)} onBrush={() => props.onBrush(same(props.brush, 'stage', card.id) ? null : { kind: 'stage', id: card.id })} />)}</ul>
      <div className="mt-3"><NewLabel testId="etapa" placeholder="Nueva etapa" onCreate={(name) => createdOrRefusal(props.send(workStageRequest(name), sendWorkStage))} /></div>
      {loose.length ? (
        <div data-testid="etapas-sin-etapa" className="mt-4 rounded-xl border border-dashed border-outline/30 p-3">
          <p className={KICKER}>Sin etapa · {loose.length} {loose.length === 1 ? 'calle' : 'calles'}</p>
          <p className="mt-1 text-[13px] text-on-surface-variant">{loose.map((street) => street.name).join(' · ')}</p>
        </div>
      ) : null}
    </>
  );
}

function WorkRowView(props: { row: WorkRow; on: boolean; onBrush: () => void }) {
  const { row } = props;
  return (
    <li data-testid={`trabajo-fila-${row.id}`} className={`flex items-center gap-3 rounded-xl border-[1.5px] bg-surface px-3 py-2.5 ${props.on ? 'border-primary' : 'border-outline/15'}`}>
      <span className="w-5 shrink-0 text-center font-mono text-[12px] font-bold text-on-surface-variant">{row.order}</span>
      <span aria-hidden className="h-3 w-8 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
      <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-on-surface">{row.name}</p><p className="font-mono text-[12px] text-on-surface-variant">{row.line}</p></div>
      <button type="button" data-testid={`trabajo-brocha-${row.id}`} aria-pressed={props.on} onClick={props.onBrush} className={brushClass(props.on)}><Paintbrush size={14} />{props.on ? 'Pintando' : 'Pintar'}</button>
    </li>
  );
}

function Works(props: Omit<Props, 'kind' | 'onClose'>) {
  return (
    <>
      <ul className="mt-4 space-y-2">{workRowsOf(props.map).map((row) => <WorkRowView key={row.id} row={row} on={same(props.brush, 'work', row.id)} onBrush={() => props.onBrush(same(props.brush, 'work', row.id) ? null : { kind: 'work', id: row.id })} />)}</ul>
      <div className="mt-3"><NewLabel testId="trabajo" placeholder="Agregar trabajo" colors={WORK_TAG_COLORS} onCreate={(name, color) => createdOrRefusal(props.send(workTagRequest(name, color), sendWorkTag))} /></div>
      <p className="mt-4 text-[12px] text-on-surface-variant">Una calle sin un trabajo no cuenta como pendiente.</p>
    </>
  );
}

/** «Etapas» (o-04) and «Trabajos» (o-05): what each covers, and the brush to paint them on streets. */
export function WorkLayers(props: Props) {
  const stages = props.kind === 'stages';
  return (
    <div data-testid={stages ? 'mapa-etapas' : 'mapa-trabajos'} className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-5">
      <div className="flex items-start justify-between gap-2 border-b border-outline/15 pb-4">
        <div>
          <p className={`${KICKER} text-primary`}>{stages ? 'Partir la obra' : 'Qué se hace en cada calle'}</p>
          <p className="mt-1 text-xl font-extrabold text-on-surface">{stages ? 'Etapas' : 'Trabajos'}</p>
        </div>
        <button type="button" aria-label="Cerrar" onClick={props.onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline/20 text-on-surface"><X size={16} /></button>
      </div>
      {stages ? <Stages {...props} /> : <Works {...props} />}
    </div>
  );
}

/** The brush over the map: a tap toggles the street, «Deshacer» puts the last one back. */
export function useBrush(map: WorkMap, send: MapEditSend | undefined) {
  const [brush, setBrushState] = useState<Brush | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const current = useRef(map);
  current.current = map;
  const sendScope = (request: Parameters<MapEditSend>[0]) => (send ? send(request, sendWorkScope) : Promise.resolve({ ok: false as const, message: NO_EDIT }));
  const setBrush = (next: Brush | null) => { setError(null); setStrokes([]); setBrushState(next); };
  const tap = async (place: WorkMapPoint) => {
    if (!brush || busy) return;
    setBusy(true);
    const { failure, stroke } = await paintAt(current.current, brush, place, sendScope, () => crypto.randomUUID());
    setBusy(false);
    setError(failure);
    if (stroke) setStrokes((done) => [...done, stroke]);
  };
  const undo = async () => {
    const last = strokes[strokes.length - 1];
    if (!last || busy) return;
    setBusy(true);
    const failure = await undoStroke(last, current.current, sendScope);
    setBusy(false);
    setError(failure);
    if (!failure) setStrokes((done) => done.slice(0, -1));
  };
  return { brush, setBrush, tap, undo, error, busy, canUndo: strokes.length > 0 };
}
