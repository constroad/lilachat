import { Camera, CheckCircle2, ChevronRight, Clock, Container, Plus, Ruler, Send, Thermometer, Truck } from 'lucide-react';
import { ADD_EXTRA_PHOTO, ALBUM_CTA, dataRowLine, dataSectionOf, extraPhotosOf, extraPhotosTitle, nextSlotOf, photoSlotsOf, placementOf, QUEUE_BADGES, slotMeasureOf, takeLabelOf, unitAlbumCta, type PhotoToView, type QueuedUnit, type RepeatItem, type RepeatSection, type SectionPath, type UnitSlot } from '@lilachat/shared';
import { Pill, StateDot } from './ReportSectionsWeb';

/** Designs pv2-01/pv2-04 (José 20/11): the unit on the card, its four photos with their measure, and one clear «Terminar unidad». */
const ICONS = { ingreso: Truck, temperatura: Thermometer, escantillon: Ruler, vacia: Container } as const;
const iconOf = (kind?: string) => (kind && kind in ICONS ? ICONS[kind as keyof typeof ICONS] : Camera);
const slotLabel = (title: string): string => title.replace(/^foto de\s+/i, '').split(' · ')[0]!;

export type Open = (path: SectionPath) => void;
export type ViewPhoto = (photo: PhotoToView) => void;

/** One photo of the unit: its thumbnail with a check and its measure, or a dashed camera to take it. */
function PhotoSlot({ item, slot, next, onOpen, onView }: { item: RepeatItem; slot: UnitSlot; next: boolean; onOpen: () => void; onView: (url: string) => void }) {
  const Icon = iconOf(slot.section.photoKind);
  const measure = slotMeasureOf(item, slot);
  const frame = slot.done ? 'border border-outline/15 bg-primary/10' : next ? 'border-2 border-dashed border-primary bg-primary/5' : 'border-2 border-dashed border-outline/30 bg-surface-variant';
  return (
    <button type="button" data-testid={`foto-${item.id}-${slot.section.id}`} onClick={() => (slot.photo ? onView(slot.photo.url) : onOpen())} aria-label={slot.section.title} className="flex min-w-0 flex-col items-center">
      <span className={`relative grid aspect-square w-full max-w-[96px] place-items-center overflow-hidden rounded-xl ${frame}`}>
        {slot.photo ? <img src={slot.photo.thumbUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={24} className={next ? 'text-primary' : 'text-on-surface-variant'} />}
        {slot.done ? <CheckCircle2 size={18} className="absolute right-1 top-1 rounded-full bg-surface text-primary" /> : null}
        {slot.photo?.pending ? <span data-testid={`foto-pendiente-${slot.photo.id}`} className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><Clock size={12} /></span> : null}
        {measure ? <span data-testid={`medida-${item.id}-${slot.section.id}`} className="absolute inset-x-1 bottom-1 rounded-md bg-surface/90 px-1 text-center font-mono text-[11px] font-bold text-on-surface">{measure}</span> : null}
      </span>
      <span className={`mt-1 line-clamp-2 max-w-full break-words text-center text-[11px] leading-tight ${slot.done ? 'text-on-surface-variant' : next ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>{slotLabel(slot.section.title)}</span>
    </button>
  );
}

/** Design j-07b: the unit's optional photos under the fixed ones, compact. */
function ExtraStrip({ item, section, onOpen, onView }: { item: RepeatItem; section: RepeatSection; onOpen: Open; onView: ViewPhoto }) {
  const extras = extraPhotosOf(item);
  if (!extras) return null;
  const path = { sectionId: section.id, itemId: item.id, key: extras.section.id };
  return (
    <div data-testid={`adicionales-${item.id}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-outline/10 bg-background px-2 py-1.5">
      <p className="min-w-0 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{extraPhotosTitle(extras.photos.length)}</p>
      {extras.photos.map((one) => (
        <button key={one.id || one.url} type="button" onClick={() => onView({ section: extras.section, url: one.url, path })} aria-label={[one.caption, one.hour].filter(Boolean).join(' · ') || extras.section.title} className="shrink-0">
          <img src={one.thumbUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
        </button>
      ))}
      {extras.full ? null : (
        <button type="button" data-testid={`agregar-adicional-${item.id}`} onClick={() => onOpen(path)} className="ml-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-primary/30 px-2 text-[13px] font-bold text-primary">
          <Plus size={14} /> {ADD_EXTRA_PHOTO}
        </button>
      )}
    </div>
  );
}

/** «Tomar escantillón» beside «Terminar unidad»: the next photo and the close, compact (José 20/11: no giant buttons). */
function UnitActions({ item, section, onOpen, onAlbum }: { item: RepeatItem; section: RepeatSection; onOpen: Open; onAlbum?: (item: RepeatItem) => void }) {
  const next = nextSlotOf(item);
  const cta = unitAlbumCta(item);
  const finishing = cta?.label === ALBUM_CTA.finish;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline/10 pt-3">
      {cta?.sentNote ? <p data-testid={`album-enviado-${item.id}`} className="mr-auto text-xs text-on-surface-variant">{cta.sentNote}</p> : null}
      {next ? (
        <button type="button" data-testid={`tomar-siguiente-${item.id}`} onClick={() => onOpen({ sectionId: section.id, itemId: item.id, key: next.section.id })} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-outline/25 px-3 text-sm font-semibold">
          <Camera size={16} className="text-primary" /> {takeLabelOf(next)}
        </button>
      ) : null}
      {cta && onAlbum ? (
        <button type="button" data-testid={`terminar-${item.id}`} onClick={() => onAlbum(item)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${finishing ? 'bg-primary text-on-primary' : 'border border-primary/30 bg-primary/10 text-primary'}`}>
          {finishing ? <CheckCircle2 size={16} /> : <Send size={16} />} {cta.label}
        </button>
      ) : null}
    </div>
  );
}

/** The unit on the card: number and plate, its status, the four photos, extras, its other data and the actions. */
export function UnitCardWeb({ unit, section, onOpen, onView, onAlbum }: { unit: QueuedUnit; section: RepeatSection; onOpen: Open; onView: ViewPhoto; onAlbum?: (item: RepeatItem) => void }) {
  const { item } = unit;
  const data = dataSectionOf(item);
  const slots = photoSlotsOf(item);
  const next = nextSlotOf(item);
  const placement = placementOf(item);
  return (
    <article data-testid={`unidad-${item.id}`} className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${unit.status === 'unloading' ? 'border-primary/50' : 'border-outline/15'}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {unit.kicker ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{unit.kicker}</p> : null}
          <p className="truncate font-mono text-[26px] font-bold leading-tight">{unit.plate}</p>
          <p data-testid={`linea-${item.id}`} className="truncate text-sm text-on-surface-variant">{[unit.line, placement].filter(Boolean).join(' · ')}</p>
        </div>
        <Pill badge={QUEUE_BADGES[unit.status]} testId={`estado-${item.id}`} />
      </header>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => {
          const path = { sectionId: section.id, itemId: item.id, key: slot.section.id };
          return <PhotoSlot key={slot.section.id} item={item} slot={slot} next={slot === next} onOpen={() => onOpen(path)} onView={(url) => onView({ section: slot.section, url, path })} />;
        })}
      </div>
      <ExtraStrip item={item} section={section} onOpen={onOpen} onView={onView} />
      {data ? (
        <button type="button" data-testid={`datos-${item.id}`} onClick={() => onOpen({ sectionId: section.id, itemId: item.id, key: data.id })} className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-1 text-left hover:bg-background/60">
          <StateDot state={data.state} small />
          <span className="flex-1 truncate text-sm">{dataRowLine(data)}</span>
          <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
        </button>
      ) : null}
      <UnitActions item={item} section={section} onOpen={onOpen} onAlbum={onAlbum} />
    </article>
  );
}
