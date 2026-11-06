import { useState, type ReactNode } from 'react';
import { Camera, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, Container, Ruler, Thermometer, Truck } from 'lucide-react';
import { ARRIVED_LABEL, dataSectionOf, pageLine, photoSlotsOf, sectionRowLine, UNIT_GROUP_TITLES, unitBadgeOf, unitCountsLine, unitGroupsOf, unitLineOf, unitStateOf, unitTitleOf, type PhotoToView, type RepeatItem, type RepeatSection, type SectionPath, type UnitSlot } from '@lilachat/shared';
import { Pill, ResultsStrip, StateDot } from './ReportSectionsWeb';

/** Design j-05 (José 06/11): for the operator on the pista. Big plate, big slots, one click per action. */
const ICONS = { ingreso: Truck, temperatura: Thermometer, escantillon: Ruler, vacia: Container } as const;
const iconOf = (kind?: string) => (kind && kind in ICONS ? ICONS[kind as keyof typeof ICONS] : Camera);
const NO_UNITS = 'Todavía no salió ningún volquete de planta.';
const slotLabel = (title: string): string => title.replace(/^foto de\s+/i, '');

type Open = (path: SectionPath) => void;
type ViewPhoto = (photo: PhotoToView) => void;

/** One photo of the unit: its thumbnail with a check, or a dashed camera to take it with one click. */
function PhotoSlot({ slot, itemId, onOpen, onView }: { slot: UnitSlot; itemId: string; onOpen: () => void; onView: (url: string) => void }) {
  const Icon = iconOf(slot.section.photoKind);
  return (
    <button type="button" data-testid={`foto-${itemId}-${slot.section.id}`} onClick={() => (slot.photo ? onView(slot.photo.url) : onOpen())} aria-label={slot.section.title} className="flex w-[72px] flex-col items-center">
      <span className={`relative grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-2xl ${slot.done ? 'bg-primary/10' : 'border-2 border-dashed border-primary/50 bg-surface-variant'}`}>
        {slot.photo ? <img src={slot.photo.thumbUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={28} className="text-primary" />}
        {slot.done ? <CheckCircle2 size={18} className="absolute right-1 top-1 rounded-full bg-surface text-primary" /> : null}
        {slot.photo?.pending ? <span data-testid={`foto-pendiente-${slot.photo.id}`} className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><Clock size={12} /></span> : null}
      </span>
      <span className={`mt-1 truncate text-[11px] ${slot.done ? 'text-on-surface-variant' : 'font-bold text-primary'}`}>{slotLabel(slot.section.title)}</span>
    </button>
  );
}

/** A volquete on its way, in one row: any of them can be next, because the order of arrival depends on nothing. «Llegó» opens its data with the hour of the click. */
function WaitingRow({ item, section, onOpen }: { item: RepeatItem; section: RepeatSection; onOpen: Open }) {
  const data = dataSectionOf(item);
  const { plate } = unitTitleOf(item);
  return (
    <li data-testid={`unidad-${item.id}`} className="flex items-center gap-3 border-b border-outline/10 px-3 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[21px] font-bold leading-tight">{plate}</p>
        {unitLineOf(item) ? <p className="truncate text-xs text-on-surface-variant">{unitLineOf(item)}</p> : null}
      </div>
      {data ? (
        <button type="button" data-testid={`llego-${item.id}`} onClick={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} aria-label={`${ARRIVED_LABEL} ${plate}`} className="flex min-h-[52px] min-w-[96px] items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-on-primary">
          <Truck size={18} />
          <span className="text-[14px] font-bold uppercase">{ARRIVED_LABEL}</span>
        </button>
      ) : null}
    </li>
  );
}

/** A unit on site: number and plate, its pill, the four photo slots and the line of its data. */
function ArrivedCard({ item, section, onOpen, onView }: { item: RepeatItem; section: RepeatSection; onOpen: Open; onView: ViewPhoto }) {
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
        {photoSlotsOf(item).map((slot) => {
          const path = { sectionId: section.id, itemId: item.id, key: slot.section.id };
          return <PhotoSlot key={slot.section.id} slot={slot} itemId={item.id} onOpen={() => onOpen(path)} onView={(url) => onView({ section: slot.section, url, path })} />;
        })}
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

/** The finished ones fold away: they no longer need the person, and twelve of them would bury the rest. */
function FinishedGroup({ items, section, onOpen, onView }: { items: RepeatItem[]; section: RepeatSection; onOpen: Open; onView: ViewPhoto }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <section className="flex flex-col gap-3">
      <button type="button" data-testid="ver-terminadas" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-[44px] items-center gap-3 text-left">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{UNIT_GROUP_TITLES.finished}</span>
        <span className="text-[12px] font-bold text-primary">{items.length}</span>
        <Chevron size={18} className="text-primary" />
      </button>
      {open ? items.map((item) => <ArrivedCard key={item.id} item={item} section={section} onOpen={onOpen} onView={onView} />) : null}
    </section>
  );
}

/**
 * The units of a control de pista (design j-05, reordered after the test with
 * twelve volquetes, José 06/11): first the ones on site, which are the work at
 * hand; then the ones on their way, as rows that force no order; the ones still
 * at the plant as a line; the finished ones folded. Nobody adds a unit; Portal
 * lists the order's dispatches.
 */
export function ReportUnitsWeb({ section, onOpen, onView }: { section: RepeatSection; onOpen: Open; onView: ViewPhoto }) {
  const groups = unitGroupsOf(section);
  const head = [unitCountsLine(groups), pageLine(section)].filter(Boolean).join(' · ');
  return (
    <div data-testid={`unidades-${section.id}`} className="flex flex-col gap-4">
      {section.summary.length ? <p data-testid="resumen-unidades" className="text-[15px] font-bold">{section.summary.join(' · ')}</p> : null}
      {head ? <p data-testid="conteo-unidades" className="text-sm text-on-surface-variant">{head}</p> : null}
      {section.items.length === 0 ? <p className="pt-4 text-center text-sm text-on-surface-variant">{NO_UNITS}</p> : null}
      {groups.onSite.length ? <Group title={UNIT_GROUP_TITLES.onSite} count={groups.onSite.length}>{groups.onSite.map((item) => <ArrivedCard key={item.id} item={item} section={section} onOpen={onOpen} onView={onView} />)}</Group> : null}
      {groups.waiting.length ? (
        <Group title={UNIT_GROUP_TITLES.waiting} count={groups.waiting.length}>
          <ul className="overflow-hidden rounded-xl border border-outline/15 bg-surface">{groups.waiting.map((item) => <WaitingRow key={item.id} item={item} section={section} onOpen={onOpen} />)}</ul>
        </Group>
      ) : null}
      {groups.atPlant.length ? <Group title={UNIT_GROUP_TITLES.atPlant} count={groups.atPlant.length}><p data-testid="unidades-en-planta" className="font-mono text-sm text-on-surface-variant">{groups.atPlant.map((item) => unitTitleOf(item).plate).join(' · ')}</p></Group> : null}
      {groups.finished.length ? <FinishedGroup items={groups.finished} section={section} onOpen={onOpen} onView={onView} /> : null}
      <ResultsStrip results={section.results} testId="resultados-unidades" />
    </div>
  );
}
