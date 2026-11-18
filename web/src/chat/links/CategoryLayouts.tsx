import { ArrowRight, ArrowUpDown, Merge, Pencil, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CategoryChip, CategoryFilter, CategorySection, CategoryView } from '@lilachat/shared';
import { SECTION_PREVIEW, type FilterHeading, type LinkOrder } from './categoryViewModel';
import { LinkGridCard, LinkRowCard, type LinkCardActions } from './LinkNoteCards';

/**
 * The two layouts of «Por categoría» (design nl-01): a categories column and
 * a grid on a computer, chips and sections of rows on a phone.
 */
export type SearchProps = { query: string; onQuery: (query: string) => void };

export function SearchField({ query, onQuery, compact }: SearchProps & { compact?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-1 items-center gap-3 rounded-card border border-outline/20 bg-surface px-3 shadow-sm focus-within:border-primary ${compact ? 'h-10' : 'min-h-[48px] py-1.5'}`}>
      <Search size={18} aria-hidden className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1">
        <input type="search" data-testid="buscar-enlaces" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar en tus enlaces" aria-label="Buscar en tus enlaces" className="w-full bg-transparent text-[14px] leading-5 text-on-surface outline-none placeholder:text-on-surface-variant" />
        {compact || query ? null : <span className="block text-[12px] leading-4 text-on-surface-variant">por autor, descripción o texto del post</span>}
      </span>
    </label>
  );
}

function RailButton({ chip, active, onPick }: { chip: CategoryChip; active: boolean; onPick: () => void }) {
  return (
    <button type="button" data-testid={`categoria-${chip.id}`} aria-current={active ? 'true' : undefined} onClick={onPick} className={`relative flex min-h-[36px] w-full items-center justify-between gap-2 rounded-thumb px-3 text-left text-[13px] ${active ? 'bg-primary/10 font-bold text-primary' : 'font-medium text-on-surface hover:bg-background'}`}>
      {active ? <span aria-hidden className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r-full bg-primary" /> : null}
      <span className="truncate">{chip.name}</span>
      <span className={`shrink-0 text-[12px] tabular-nums ${active ? 'font-bold' : 'text-on-surface-variant'}`}>{chip.count}</span>
    </button>
  );
}

function ReviewButton(props: { id: CategoryFilter; label: string; count: number; tone: 'warning' | 'error'; active: boolean; onPick: () => void }) {
  if (!props.count) return null;
  const pill = props.tone === 'warning' ? 'border-warning/40 bg-warning/10 text-warning' : 'border-error/30 bg-error/10 text-error';
  return (
    <button type="button" data-testid={`revision-${props.id}`} aria-current={props.active ? 'true' : undefined} onClick={props.onPick} className={`flex min-h-[32px] w-full items-center justify-between gap-2 rounded-thumb px-2.5 text-left text-[12px] font-medium ${props.active ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-background'}`}>
      <span className="truncate">{props.label}</span>
      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${pill}`}>{props.count}</span>
    </button>
  );
}

const hasReview = (view: CategoryView) => view.review.commentBait > 0 || view.review.unreadable > 0;

/** The 240 px column: «CATEGORÍAS» and, when there is something, «REVISIÓN». */
export function CategoryRail({ view, only, onOnly }: { view: CategoryView; only: CategoryFilter; onOnly: (only: CategoryFilter) => void }) {
  return (
    <nav aria-label="Categorías" className="flex w-[240px] shrink-0 flex-col justify-between overflow-y-auto border-r border-outline/15 bg-surface px-3 py-4">
      <div className="flex flex-col gap-1">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Categorías</p>
        {view.chips.map((chip) => <RailButton key={chip.id} chip={chip} active={only === chip.id} onPick={() => onOnly(chip.id)} />)}
      </div>
      {hasReview(view) ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-outline/15 pt-3">
          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Revisión</p>
          <ReviewButton id="commentBait" label="Solo piden comentar" count={view.review.commentBait} tone="warning" active={only === 'commentBait'} onPick={() => onOnly('commentBait')} />
          <ReviewButton id="unreadable" label="No se pudieron leer" count={view.review.unreadable} tone="error" active={only === 'unreadable'} onPick={() => onOnly('unreadable')} />
        </div>
      ) : null}
    </nav>
  );
}

export function OrderSelect({ order, onOrder }: { order: LinkOrder; onOrder: (order: LinkOrder) => void }) {
  return (
    <label className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3 text-[13px] font-semibold text-on-surface shadow-sm focus-within:border-primary">
      <ArrowUpDown size={16} aria-hidden className="text-on-surface-variant" />
      <span className="sr-only">Orden</span>
      <select data-testid="orden-enlaces" value={order} onChange={(event) => onOrder(event.target.value === 'oldest' ? 'oldest' : 'newest')} className="bg-transparent outline-none">
        <option value="newest">Más nuevos</option>
        <option value="oldest">Más viejos</option>
      </select>
    </label>
  );
}

function HeadingAction({ testId, icon, label, onClick }: { testId: string; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className="flex h-8 items-center gap-1.5 rounded-lg border border-outline/20 bg-surface px-3 text-[12px] font-semibold text-on-surface shadow-sm hover:border-primary hover:text-primary">
      {icon}
      {label}
    </button>
  );
}

export function WideHeading({ heading, onRename, onMerge }: { heading: FilterHeading; onRename: () => void; onMerge: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-outline/15 pb-4">
      <div className="min-w-0">
        <p data-testid="titulo-filtro-kicker" className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{heading.kicker}</p>
        <h2 data-testid="titulo-filtro" className="truncate text-[24px] font-extrabold leading-tight tracking-tight text-on-surface">{heading.title}</h2>
      </div>
      {heading.category ? (
        <div className="flex items-center gap-2">
          <HeadingAction testId="btn-renombrar-categoria" icon={<Pencil size={14} aria-hidden />} label="Renombrar" onClick={onRename} />
          <HeadingAction testId="btn-unir-categoria-abrir" icon={<Merge size={14} aria-hidden />} label="Unir con…" onClick={onMerge} />
        </div>
      ) : null}
    </div>
  );
}

function SectionKicker({ section, children }: { section: CategorySection; children?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 data-testid={`seccion-${section.id}`} className="flex min-w-0 items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        <span className="truncate">{section.name} · {section.count}</span>
      </h3>
      {children}
    </div>
  );
}

export function WideSections({ sections, grouped, actions }: { sections: CategorySection[]; grouped: boolean; actions: LinkCardActions }) {
  return (
    <div className="mt-6 space-y-8">
      {sections.map((section) => (
        <section key={section.id}>
          {grouped ? <SectionKicker section={section} /> : null}
          <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
            {section.items.map((item) => <LinkGridCard key={item.seq} item={item} actions={actions} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/** One row of chips with their counts, scrolling sideways (nl-01 mobile). */
export function CategoryChips({ view, only, onOnly }: { view: CategoryView; only: CategoryFilter; onOnly: (only: CategoryFilter) => void }) {
  const review: CategoryChip[] = [
    ...(view.review.commentBait ? [{ id: 'commentBait', name: 'Solo piden comentar', count: view.review.commentBait }] : []),
    ...(view.review.unreadable ? [{ id: 'unreadable', name: 'No se pudieron leer', count: view.review.unreadable }] : []),
  ];
  return (
    <div role="tablist" aria-label="Categorías" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {[...view.chips, ...review].map((chip) => {
        const active = only === chip.id;
        return (
          <button key={chip.id} type="button" role="tab" aria-selected={active} data-testid={`chip-${chip.id}`} onClick={() => onOnly(chip.id)} className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-card border px-4 text-[14px] ${active ? 'border-primary bg-primary font-bold text-on-primary' : 'border-outline/15 bg-surface font-medium text-on-surface'}`}>
            {chip.name}
            <span className={`tabular-nums ${active ? 'opacity-90' : 'text-on-surface-variant'}`}>{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function NarrowSections({ sections, preview, onSeeAll, actions }: { sections: CategorySection[]; preview: boolean; onSeeAll: (id: string) => void; actions: LinkCardActions }) {
  return (
    <div className="mt-5 space-y-6">
      {sections.map((section) => {
        const cut = preview && section.items.length > SECTION_PREVIEW;
        const seeAll = cut ? (
          <button type="button" data-testid={`ver-todas-${section.id}`} onClick={() => onSeeAll(section.id)} className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary">
            Ver las {section.count} <ArrowRight size={14} aria-hidden />
          </button>
        ) : null;
        return (
          <section key={section.id}>
            <SectionKicker section={section}>{seeAll}</SectionKicker>
            <div className="space-y-3">
              {(cut ? section.items.slice(0, SECTION_PREVIEW) : section.items).map((item) => <LinkRowCard key={item.seq} item={item} actions={actions} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
