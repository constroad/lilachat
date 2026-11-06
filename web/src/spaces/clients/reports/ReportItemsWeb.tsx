import { ChevronRight, Clock, Plus } from 'lucide-react';
import { itemsLine, sectionPhotos, sectionRowLine, type FormSection, type RepeatItem, type RepeatSection, type SectionPath } from '@lilachat/shared';
import { ResultsStrip, StateDot } from './ReportSectionsWeb';

/** The photos of a tramo with their caption; one still on this device says so with a clock. */
function PhotoStrip({ section, itemId }: { section: FormSection; itemId: string }) {
  const photos = sectionPhotos(section);
  if (!photos.length) return null;
  return (
    <div data-testid={`fotos-${itemId}`} className="flex gap-2 overflow-x-auto pb-2 pt-1">
      {photos.map((photo) => (
        <figure key={photo.id} className="relative w-24 shrink-0">
          <img src={photo.thumbUrl} alt={photo.caption || 'Foto del tramo'} loading="lazy" className="h-24 w-24 rounded-xl object-cover" />
          {photo.pending ? <span data-testid={`foto-pendiente-${photo.id}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><Clock size={13} /></span> : null}
          {photo.caption ? <figcaption className="mt-1 line-clamp-2 text-[11px] text-on-surface-variant">{photo.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

/** One tramo (design j-03): its kicker, where it is, what it measured and a row per subsection. */
function ItemCard({ item, section, onOpen }: { item: RepeatItem; section: RepeatSection; onOpen: (path: SectionPath) => void }) {
  return (
    <article data-testid={`item-${item.id}`} className="rounded-xl border border-outline/15 bg-surface p-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{item.title}</p>
      {item.summary.length ? <p className="mt-1 text-base font-bold">{item.summary.join(' · ')}</p> : null}
      <ResultsStrip results={item.results} testId={`resultados-${item.id}`} />
      <ul className="mt-3 divide-y divide-outline/10 border-t border-outline/10">
        {item.sections.map((one) => (
          <li key={one.id}>
            <button type="button" data-testid={`seccion-${item.id}-${one.id}`} onClick={() => onOpen({ sectionId: section.id, itemId: item.id, key: one.id })} className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left hover:bg-background/60">
              <StateDot state={one.state} small />
              <span className="flex-1 text-sm font-semibold">{one.title}</span>
              <span className="max-w-[40%] truncate text-[12px] text-on-surface-variant">{sectionRowLine(one)}</span>
              <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
            </button>
            {one.tool ? <PhotoStrip section={one} itemId={item.id} /> : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * The tramos of a report (design j-03): how many there are, «Agregar tramo»
 * (which opens the first section of a new one) and a card per tramo with its
 * subsections, each opening its own form.
 */
export function ReportItemsWeb({ section, onOpen }: { section: RepeatSection; onOpen: (path: SectionPath) => void }) {
  const first = section.template[0];
  const add = () => first && onOpen({ sectionId: section.id, itemId: null, key: first.id });
  return (
    <div data-testid={`items-${section.id}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex-1 text-sm text-on-surface-variant">{itemsLine(section)}</p>
        {first ? (
          <button type="button" data-testid="agregar-item" onClick={add} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/15">
            <Plus size={16} /> {section.addLabel}
          </button>
        ) : null}
      </div>
      {section.items.length === 0 ? <p className="pt-4 text-center text-sm text-on-surface-variant">{`Agrega el primer ${section.itemTitle.toLowerCase()} para empezar.`}</p> : null}
      {section.items.map((item) => <ItemCard key={item.id} item={item} section={section} onOpen={onOpen} />)}
    </div>
  );
}
