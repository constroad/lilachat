import type { ReactNode } from 'react';
import { Camera, CheckCircle2, ChevronRight, Clock, Container, Ruler, Thermometer, Truck } from 'lucide-react';
import { ARRIVED_LABEL, dataSectionOf, itemsLine, pageLine, photoSlotsOf, sectionRowLine, UNIT_GROUP_TITLES, unitBadgeOf, unitGroupsOf, unitLineOf, unitStateOf, unitTitleOf, type RepeatItem, type RepeatSection, type SectionPath, type UnitSlot } from '@lilachat/shared';
import { Pill, ResultsStrip, StateDot } from './ReportSectionsWeb';

/** Design j-05 (José 06/11): for the operator on the pista. Big plate, big slots, one click per action. */
const ICONS = { ingreso: Truck, temperatura: Thermometer, escantillon: Ruler, vacia: Container } as const;
const iconOf = (kind?: string) => (kind && kind in ICONS ? ICONS[kind as keyof typeof ICONS] : Camera);
const NO_UNITS = 'Todavía no salió ningún volquete de planta.';
const slotLabel = (title: string): string => title.replace(/^foto de\s+/i, '');

type Open = (path: SectionPath) => void;

/** One photo of the unit: its thumbnail with a check, or a dashed camera to take it with one click. */
function PhotoSlot({ slot, itemId, onOpen }: { slot: UnitSlot; itemId: string; onOpen: () => void }) {
  const Icon = iconOf(slot.section.photoKind);
  return (
    <button type="button" data-testid={`foto-${itemId}-${slot.section.id}`} onClick={onOpen} aria-label={slot.section.title} className="flex w-[72px] flex-col items-center">
      <span className={`relative grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-2xl ${slot.done ? 'bg-primary/10' : 'border-2 border-dashed border-primary/50 bg-surface-variant'}`}>
        {slot.photo ? <img src={slot.photo.thumbUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={28} className="text-primary" />}
        {slot.done ? <CheckCircle2 size={18} className="absolute right-1 top-1 rounded-full bg-surface text-primary" /> : null}
        {slot.photo?.pending ? <span data-testid={`foto-pendiente-${slot.photo.id}`} className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><Clock size={12} /></span> : null}
      </span>
      <span className={`mt-1 truncate text-[11px] ${slot.done ? 'text-on-surface-variant' : 'font-bold text-primary'}`}>{slotLabel(slot.section.title)}</span>
    </button>
  );
}

/** A volquete that left the plant: its plate and «Llegó», which opens its data with the hour already there. */
function WaitingCard({ item, section, onOpen }: { item: RepeatItem; section: RepeatSection; onOpen: Open }) {
  const data = dataSectionOf(item);
  const { plate } = unitTitleOf(item);
  return (
    <article data-testid={`unidad-${item.id}`} className="flex items-center gap-3 rounded-xl border border-outline/15 bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[28px] font-bold leading-tight">{plate}</p>
        {unitLineOf(item) ? <p className="mt-0.5 text-[13px] text-on-surface-variant">{unitLineOf(item)}</p> : null}
      </div>
      {data ? (
        <button type="button" data-testid={`llego-${item.id}`} onClick={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} aria-label={`${ARRIVED_LABEL} ${plate}`} className="flex min-h-[64px] min-w-[96px] flex-col items-center justify-center rounded-2xl bg-primary px-4 text-on-primary hover:opacity-90">
          <Truck size={22} />
          <span className="text-[14px] font-bold uppercase">{ARRIVED_LABEL}</span>
        </button>
      ) : null}
    </article>
  );
}

/** A unit on site: number and plate, its pill, the four photo slots and the line of its data. */
function ArrivedCard({ item, section, onOpen }: { item: RepeatItem; section: RepeatSection; onOpen: Open }) {
  const { kicker, plate } = unitTitleOf(item);
  const data = dataSectionOf(item);
  const working = unitStateOf(item) === 'working';
  return (
    <article data-testid={`unidad-${item.id}`} className={`rounded-xl border bg-surface p-4 ${working ? 'border-primary/40' : 'border-outline/15'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {kicker ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{kicker}</p> : null}
          <p className="truncate font-mono text-[28px] font-bold leading-tight">{plate}</p>
        </div>
        <Pill badge={unitBadgeOf(item)} testId={`estado-${item.id}`} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        {photoSlotsOf(item).map((slot) => <PhotoSlot key={slot.section.id} slot={slot} itemId={item.id} onOpen={() => onOpen({ sectionId: section.id, itemId: item.id, key: slot.section.id })} />)}
      </div>
      {data ? (
        <button type="button" data-testid={`datos-${item.id}`} onClick={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} className="mt-3 flex min-h-[44px] w-full items-center gap-2 border-t border-outline/10 pt-2 text-left hover:bg-background/60">
          <StateDot state={data.state} small />
          <span className="flex-1 truncate text-sm font-semibold">{sectionRowLine(data)}</span>
          <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
        </button>
      ) : null}
    </article>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{title}</h3>
        <span className="text-[12px] font-bold text-primary">{count}</span>
      </header>
      {children}
    </section>
  );
}

/**
 * The units of a control de pista (design j-05): the volquetes that left the
 * plant, to click when each one reaches the pista, and the ones on site by
 * arrival. Nobody adds a unit; Portal lists the order's dispatches.
 */
export function ReportUnitsWeb({ section, onOpen }: { section: RepeatSection; onOpen: Open }) {
  const groups = unitGroupsOf(section);
  const head = [itemsLine(section), pageLine(section)].filter(Boolean).join(' · ');
  return (
    <div data-testid={`unidades-${section.id}`} className="flex flex-col gap-4">
      {section.summary.length ? <p data-testid="resumen-unidades" className="text-[15px] font-bold">{section.summary.join(' · ')}</p> : null}
      <ResultsStrip results={section.results} testId="resultados-unidades" />
      <p className="text-sm text-on-surface-variant">{head}</p>
      {section.items.length === 0 ? <p className="pt-4 text-center text-sm text-on-surface-variant">{NO_UNITS}</p> : null}
      {groups.waiting.length ? <Group title={UNIT_GROUP_TITLES.waiting} count={groups.waiting.length}>{groups.waiting.map((item) => <WaitingCard key={item.id} item={item} section={section} onOpen={onOpen} />)}</Group> : null}
      {groups.arrived.length ? <Group title={UNIT_GROUP_TITLES.arrived} count={groups.arrived.length}>{groups.arrived.map((item) => <ArrivedCard key={item.id} item={item} section={section} onOpen={onOpen} />)}</Group> : null}
    </div>
  );
}
