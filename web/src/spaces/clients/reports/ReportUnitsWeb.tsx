import { useState, type DragEvent, type ReactElement } from 'react';
import { ArrowUp, ChevronDown, ChevronUp, GripVertical, Truck } from 'lucide-react';
import { ARRIVED_LABEL, arrivalKeyOf, canMoveNext, FINISHED_TITLE, isClosedStatus, isOpenStatus, MOVE_NEXT_LABEL, moveNext, moveUnit, openOrderOf, pageLine, QUEUE_BADGES, QUEUE_HINT, QUEUE_TITLE, queueCountsLine, queueVolumeLine, selectedUnitOf, SELECTED_TITLE, UNITS_CLOSE_HINT, UNLOADING_TITLE, unloadQueueOf, type QueuedUnit, type UnitsQueueViewProps, type RepeatSection } from '@lilachat/shared';
import { Pill, ResultsStrip } from './ReportSectionsWeb';
import { UnitCardWeb, type Open } from './UnitCardWeb';

const NO_UNITS = 'Todavía no salió ningún volquete de planta.';
const DRAG_TYPE = 'text/plain';

type Props = UnitsQueueViewProps;

type RowProps = { unit: QueuedUnit; section: RepeatSection; selected: boolean; onOpen: Open; onSelect: (itemId: string) => void; onNext?: () => void; drag?: { onStart: () => void; onDrop: () => void } };

/** The number in line: filled for the one unloading. */
function Position({ unit }: { unit: QueuedUnit }) {
  const unloading = unit.status === 'unloading';
  return <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${unloading ? 'bg-primary text-on-primary' : 'border border-outline/25 text-on-surface-variant'}`}>{unit.position}</span>;
}

/** «Llegó» on a truck not here yet: it opens the ingreso photo (José 07/11). */
function ArrivedButton({ unit, section, onOpen }: { unit: QueuedUnit; section: RepeatSection; onOpen: Open }) {
  const arrival = arrivalKeyOf(unit.item);
  if (!arrival) return null;
  return (
    <button type="button" data-testid={`llego-${unit.item.id}`} onClick={() => onOpen({ sectionId: section.id, itemId: unit.item.id, key: arrival })} aria-label={`${ARRIVED_LABEL} ${unit.plate}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-bold text-on-primary">
      <Truck size={16} /> {ARRIVED_LABEL}
    </button>
  );
}

/** One unit in line: the handle to drag it, its number, plate and line, its status and «Siguiente ↑». */
function QueueRow({ unit, section, selected, onOpen, onSelect, onNext, drag }: RowProps) {
  const away = unit.status === 'onTheWay';
  const dragProps = drag ? { draggable: true, onDragStart: (event: DragEvent) => { event.dataTransfer.setData(DRAG_TYPE, unit.item.id); drag.onStart(); }, onDragOver: (event: DragEvent) => event.preventDefault(), onDrop: (event: DragEvent) => { event.preventDefault(); drag.onDrop(); } } : {};
  return (
    <li data-testid={`cola-${unit.item.id}`} {...dragProps} className={`flex items-center gap-2 border-b border-outline/10 px-2 py-2 last:border-b-0 ${selected ? 'bg-primary/10' : ''} ${away ? 'opacity-70' : ''}`}>
      {drag ? <GripVertical size={18} aria-hidden className="shrink-0 cursor-grab text-on-surface-variant" /> : <span className="w-[18px] shrink-0" />}
      <Position unit={unit} />
      <button type="button" data-testid={`elegir-${unit.item.id}`} disabled={away} onClick={() => onSelect(unit.item.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate font-mono text-[15px] font-bold">{unit.plate}</span>
        <span className="block break-words text-xs leading-snug text-on-surface-variant">{unit.line}</span>
      </button>
      {away ? <ArrivedButton unit={unit} section={section} onOpen={onOpen} /> : <Pill badge={QUEUE_BADGES[unit.status]} testId={`estado-cola-${unit.item.id}`} />}
      {onNext ? (
        <button type="button" data-testid={`siguiente-${unit.item.id}`} onClick={onNext} aria-label={`${MOVE_NEXT_LABEL}: ${unit.plate}`} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-outline/25 px-2 text-[13px] font-semibold">
          {MOVE_NEXT_LABEL} <ArrowUp size={14} />
        </button>
      ) : null}
    </li>
  );
}

/** The closed units fold away: they no longer need the person. */
function FinishedRows({ units, render }: { units: QueuedUnit[]; render: (unit: QueuedUnit) => ReactElement }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  if (!units.length) return null;
  return (
    <div className="border-t border-outline/10">
      <button type="button" data-testid="ver-terminadas" onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-10 w-full items-center gap-2 px-3 text-left">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{FINISHED_TITLE}</span>
        <span className="text-[12px] font-bold text-primary">{units.length}</span>
        <Chevron size={16} className="text-primary" />
      </button>
      {open ? <ul>{units.map(render)}</ul> : null}
    </div>
  );
}

/** The queue (pv2-01/pv2-04 left): the open units to reorder, the ones on their way, the closed ones folded. */
function QueueList({ queue, section, selectedId, onOpen, onSelect, onReorder }: { queue: QueuedUnit[]; section: RepeatSection; selectedId: string | null; onOpen: Open; onSelect: (itemId: string) => void; onReorder?: (order: string[]) => void }) {
  const [dragged, setDragged] = useState<string | null>(null);
  const order = openOrderOf(queue);
  const reorder = (next: string[]) => onReorder?.(next);
  const rowOf = (unit: QueuedUnit) => {
    const open = isOpenStatus(unit.status) && onReorder;
    const drag = open ? { onStart: () => setDragged(unit.item.id), onDrop: () => dragged && dragged !== unit.item.id && reorder(moveUnit(order, dragged, order.indexOf(unit.item.id))) } : undefined;
    const onNext = onReorder && canMoveNext(unit) ? () => reorder(moveNext(order, unit.item.id)) : undefined;
    return <QueueRow key={unit.item.id} unit={unit} section={section} selected={unit.item.id === selectedId} onOpen={onOpen} onSelect={onSelect} onNext={onNext} drag={drag} />;
  };
  return (
    <section data-testid="cola-descarga" className="overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <header className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{QUEUE_TITLE}</h3>
        <span className="text-xs text-on-surface-variant">{QUEUE_HINT}</span>
      </header>
      <ul>{queue.filter((unit) => !isClosedStatus(unit.status)).map(rowOf)}</ul>
      <FinishedRows units={queue.filter((unit) => isClosedStatus(unit.status))} render={rowOf} />
    </section>
  );
}

/**
 * The units of a control de pista as an unloading queue (José 20/11, designs pv2-01…pv2-04):
 * the unit on the card with its photos and «Terminar unidad», and the queue the person orders
 * in the field. From 1024 px the queue goes left and the unit right. Nobody adds a unit; Portal
 * lists the order's dispatches.
 */
export function ReportUnitsWeb({ section, onOpen, onView, onAlbum, order, onReorder, selectedId, onSelect }: Props) {
  const queue = unloadQueueOf(section, order);
  const selected = selectedUnitOf(queue, selectedId);
  const head = [queueCountsLine(queue), queueVolumeLine(queue), pageLine(section)].filter(Boolean).join(' · ');
  return (
    <div data-testid={`unidades-${section.id}`} className="flex flex-col gap-3">
      {section.summary.length ? <p data-testid="resumen-unidades" className="text-[15px] font-bold">{section.summary.join(' · ')}</p> : null}
      {head ? <p data-testid="conteo-unidades" className="text-sm text-on-surface-variant">{head}</p> : null}
      {section.items.length ? <p data-testid="cierre-unidades" className="text-[13px] text-on-surface-variant">{UNITS_CLOSE_HINT}</p> : null}
      {section.items.length === 0 ? <p className="pt-4 text-center text-sm text-on-surface-variant">{NO_UNITS}</p> : null}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        {selected ? (
          <div className="flex flex-col gap-2 lg:order-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{selected.status === 'unloading' ? UNLOADING_TITLE : SELECTED_TITLE}</h3>
            <UnitCardWeb unit={selected} section={section} onOpen={onOpen} onView={onView} onAlbum={onAlbum} />
          </div>
        ) : null}
        {queue.length ? <div className="lg:order-1"><QueueList queue={queue} section={section} selectedId={selected?.item.id ?? null} onOpen={onOpen} onSelect={onSelect} onReorder={onReorder} /></div> : null}
      </div>
      <ResultsStrip results={section.results} testId="resultados-unidades" />
    </div>
  );
}
