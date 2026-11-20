import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildCategoryView, type CategoryFilter, type CategoryView, type LinkNoteItem } from '@lilachat/shared';
import { MergeCategoryDialog, RenameCategoryDialog } from './CategoryDialogs';
import { CategoryChips, CategoryRail, NarrowSections, OrderSelect, SearchField, WideHeading, WideSections } from './CategoryLayouts';
import { filterHeading, orderSections, validFilter, type LinkOrder } from './categoryViewModel';
import { useLinkPlayer } from './linkCardParts';
import type { LinkNotes } from './linkNotesApi';
import { useLinkNotes } from './linkNotesStore';
import type { LinkCardActions } from './LinkNoteCards';
import { LinksEmpty, LinksError, LinksSkeleton } from './LinksStates';
import { MoveLinkSheet } from './MoveLinkSheet';
import { useWideScreen } from './notesView';

/**
 * «Por categoría» of a notes chat (design nl-01, José 18/11): the links Lila
 * sorted, searchable, with what to review. It takes the place of the
 * messages and the composer; the «+» goes back to the chat to write.
 */
type Props = { jwt: string; chatId: string; onCompose: () => void };
type Dialog = 'rename' | 'merge' | null;
type Filters = { query: string; only: CategoryFilter; order: LinkOrder };

const NOTICE_MS = 2000;

function useNotice(): [string, (text: string) => void] {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  return [notice, setNotice];
}

function NoMatches({ query }: { query: string }) {
  return <p data-testid="enlaces-sin-resultados" className="mt-10 text-center text-sm text-on-surface-variant">{query.trim() ? `Ningún enlace coincide con «${query.trim()}».` : 'No hay enlaces aquí.'}</p>;
}

function WideLayout(props: { view: CategoryView; notes: LinkNotes; filters: Filters; setFilters: (next: Partial<Filters>) => void; actions: LinkCardActions; onDialog: (dialog: Dialog) => void }) {
  const { view, filters, setFilters } = props;
  const sections = orderSections(view.sections, filters.order);
  return (
    <div data-testid="vista-por-categoria" className="flex min-h-0 flex-1 bg-background">
      <CategoryRail view={view} only={filters.only} onOnly={(only) => setFilters({ only })} />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 max-w-[420px] flex-1"><SearchField compact query={filters.query} onQuery={(query) => setFilters({ query })} /></div>
          <OrderSelect order={filters.order} onOrder={(order) => setFilters({ order })} />
        </div>
        <WideHeading heading={filterHeading(filters.only, view, props.notes.categories)} onRename={() => props.onDialog('rename')} onMerge={() => props.onDialog('merge')} />
        {sections.length ? <WideSections sections={sections} grouped={filters.only === 'all'} actions={props.actions} /> : <NoMatches query={filters.query} />}
      </div>
    </div>
  );
}

function NarrowLayout(props: { view: CategoryView; filters: Filters; setFilters: (next: Partial<Filters>) => void; actions: LinkCardActions; onCompose: () => void }) {
  const { view, filters, setFilters } = props;
  return (
    <div data-testid="vista-por-categoria" className="relative flex min-h-0 flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-3">
        <SearchField query={filters.query} onQuery={(query) => setFilters({ query })} />
        <CategoryChips view={view} only={filters.only} onOnly={(only) => setFilters({ only })} />
        {view.sections.length ? <NarrowSections sections={view.sections} preview={filters.only === 'all'} onSeeAll={(only) => setFilters({ only })} actions={props.actions} /> : <NoMatches query={filters.query} />}
      </div>
      <button type="button" data-testid="btn-nota-nueva" aria-label="Escribir en el chat" onClick={props.onCompose} className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none">
        <Plus size={26} aria-hidden />
      </button>
    </div>
  );
}

function CategoryDialog({ dialog, jwt, chatId, notes, view, only, onClose, onOnly }: { dialog: Dialog; jwt: string; chatId: string; notes: LinkNotes; view: CategoryView; only: CategoryFilter; onClose: () => void; onOnly: (only: CategoryFilter) => void }) {
  const category = notes.categories.find((one) => one.id === only);
  if (!dialog || !category) return null;
  if (dialog === 'rename') return <RenameCategoryDialog jwt={jwt} chatId={chatId} category={category} onClose={onClose} />;
  const count = view.chips.find((chip) => chip.id === category.id)?.count ?? 0;
  return <MergeCategoryDialog jwt={jwt} chatId={chatId} category={category} categories={notes.categories} count={count} onClose={onClose} onMerged={onOnly} />;
}

export function LinksByCategory({ jwt, chatId, onCompose }: Props) {
  const { state, reload } = useLinkNotes(jwt, chatId, true);
  const wide = useWideScreen();
  const [filters, setAllFilters] = useState<Filters>({ query: '', only: 'all', order: 'newest' });
  const [moving, setMoving] = useState<LinkNoteItem | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useNotice();
  const player = useLinkPlayer();
  const notes = state.notes;
  if (!notes) return state.status === 'error' ? <LinksError message={state.message} onRetry={reload} /> : <LinksSkeleton wide={wide} />;
  if (!notes.items.length) return <LinksEmpty onCompose={onCompose} />;

  const only = validFilter(filters.only, buildCategoryView(notes.items, notes.categories, { query: '' }).chips);
  const view = buildCategoryView(notes.items, notes.categories, { query: filters.query, only });
  const shown = { ...filters, only };
  const setFilters = (next: Partial<Filters>) => setAllFilters((previous) => ({ ...previous, ...next }));
  const actions: LinkCardActions = { onOpen: (item) => player.open(item.link.url), onMove: setMoving, onCopied: () => setNotice('Enlace copiado') };
  return (
    <>
      {wide ? <WideLayout view={view} notes={notes} filters={shown} setFilters={setFilters} actions={actions} onDialog={setDialog} /> : <NarrowLayout view={view} filters={shown} setFilters={setFilters} actions={actions} onCompose={onCompose} />}
      {moving ? <MoveLinkSheet jwt={jwt} chatId={chatId} item={moving} notes={notes} onClose={() => setMoving(null)} /> : null}
      <CategoryDialog dialog={dialog} jwt={jwt} chatId={chatId} notes={notes} view={view} only={only} onClose={() => setDialog(null)} onOnly={(next) => setFilters({ only: next })} />
      {notice ? <p role="status" className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-on-surface px-4 py-2 text-sm text-surface shadow-lg">{notice}</p> : null}
      {player.overlay}
    </>
  );
}
