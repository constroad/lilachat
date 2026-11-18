import { ArrowRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildCategoryView, MAX_CATEGORY_NAME, MAX_LINK_CATEGORIES, type LinkCategory, type LinkNoteItem } from '@lilachat/shared';
import { FieldError, Overlay } from '../../ui/Overlay';
import { createLinkCategory, moveLinkToCategory, type LinkNotes } from './linkNotesApi';
import { loadLinkNotes, receiveMessageLink } from './linkNotesStore';
import { authorOf, LinkThumb, PlatformPill, summaryOf } from './linkCardParts';

/**
 * «Mover a · ¿En qué categoría va?» (design nl-03). The choice is the
 * person's: from then on Lila never moves that link again.
 */
type Props = { jwt: string; chatId: string; item: LinkNoteItem; notes: LinkNotes; onClose: () => void };

const NO_CATEGORY = 'none';

function ChoiceRow(props: { id: string; name: string; count?: number; current: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      data-testid={`mover-a-${props.id}`}
      onClick={props.onSelect}
      className={`relative flex min-h-[56px] w-full items-center gap-3 rounded-card border px-4 text-left transition-colors motion-reduce:transition-none ${props.selected ? 'border-primary bg-primary/5' : 'border-outline/20 hover:bg-background'}`}
    >
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${props.selected ? 'border-primary' : 'border-outline/40'}`}>{props.selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] ${props.selected ? 'font-bold text-primary' : 'font-medium text-on-surface'}`}>{props.name}</span>
        {props.current ? <span className="block text-[11px] font-bold uppercase tracking-wide text-primary">Categoría actual</span> : null}
      </span>
      {props.count !== undefined ? <span className={`text-sm tabular-nums ${props.selected ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>{props.count}</span> : null}
    </button>
  );
}

function MiniCard({ item }: { item: LinkNoteItem }) {
  const { link } = item;
  return (
    <div className="flex gap-3 rounded-card border border-outline/15 bg-background p-3">
      <LinkThumb link={link} className="aspect-[3/4] w-12" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-on-surface">
          <span className="line-clamp-2">{authorOf(link)}</span>
          <span aria-hidden className="text-on-surface-variant">·</span>
          <PlatformPill link={link} />
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-on-surface-variant">{summaryOf(link)}</p>
      </div>
    </div>
  );
}

function NewCategoryRow(props: { full: boolean; busy: boolean; onCreate: (name: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (props.full) return <p className="px-1 text-[12px] text-on-surface-variant">Llegaste al máximo de {MAX_LINK_CATEGORIES} categorías. Une dos para crear otra.</p>;
  if (!open) {
    return (
      <button type="button" data-testid="btn-nueva-categoria" onClick={() => setOpen(true)} className="flex min-h-[56px] w-full items-center gap-3 rounded-card border border-dashed border-outline/40 px-4 text-left text-[15px] font-semibold text-primary hover:bg-primary/5">
        <Plus size={18} aria-hidden /> Nueva categoría
      </button>
    );
  }
  // E2E 18/11: the name stayed in the field after «Crear», so a second tap made a duplicate.
  const submit = async () => {
    const clean = name.trim();
    if (!clean || !(await props.onCreate(clean))) return;
    setName('');
    setOpen(false);
  };
  return (
    <div className="flex gap-2">
      <input autoFocus data-testid="campo-nueva-categoria" value={name} maxLength={MAX_CATEGORY_NAME} placeholder="Nombre de la categoría" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} className="h-12 min-w-0 flex-1 rounded-card border border-outline/30 bg-surface px-3 text-[15px] outline-none focus:border-primary" />
      <button type="button" data-testid="btn-crear-categoria" disabled={!name.trim() || props.busy} onClick={() => void submit()} className="h-12 shrink-0 rounded-card bg-primary/10 px-4 text-sm font-semibold text-primary disabled:opacity-40">
        Crear
      </button>
    </div>
  );
}

export function MoveLinkSheet({ jwt, chatId, item, notes, onClose }: Props) {
  const current = item.link.categoryId ?? NO_CATEGORY;
  const [selected, setSelected] = useState(current);
  const [created, setCreated] = useState<LinkCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const categories = useMemo(() => [...notes.categories, ...created.filter((one) => !notes.categories.some((known) => known.id === one.id))], [notes.categories, created]);
  const counts = useMemo(() => new Map(buildCategoryView(notes.items, categories, { query: '' }).chips.map((chip) => [chip.id, chip.count])), [notes.items, categories]);

  const create = async (name: string) => {
    setBusy(true);
    const response = await createLinkCategory(jwt, chatId, name);
    setBusy(false);
    if (!response.ok) {
      setError(response.message);
      return false;
    }
    setError('');
    setCreated((list) => [...list, response.data.category]);
    setSelected(response.data.category.id);
    return true;
  };
  const move = async () => {
    setBusy(true);
    const response = await moveLinkToCategory(jwt, chatId, item.seq, selected === NO_CATEGORY ? null : selected);
    setBusy(false);
    if (!response.ok) return setError(response.message);
    receiveMessageLink({ chatId, seq: item.seq, link: response.data.link });
    if (created.length) void loadLinkNotes(jwt, chatId);
    onClose();
  };

  const header = (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Mover a</p>
      <h2 className="text-xl font-extrabold tracking-tight text-on-surface">¿En qué categoría va?</h2>
    </div>
  );
  const footer = (
    // 56 px tall like design nl-03, taller than the shared PrimaryButton.
    <button type="button" data-testid="btn-mover-enlace" disabled={busy || selected === current} onClick={() => void move()} className="grid h-14 w-full place-items-center rounded-card bg-primary text-sm font-semibold text-on-primary transition-opacity disabled:opacity-40">
      <span className="flex items-center gap-2">Mover <ArrowRight size={18} aria-hidden /></span>
    </button>
  );
  return (
    <Overlay title="Mover de categoría" header={header} footer={footer} onClose={onClose}>
      <MiniCard item={item} />
      {item.link.categoryBy ? (
        <p data-testid="quien-eligio" className="mt-2 flex items-center gap-2 text-[13px] text-on-surface-variant">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
          {item.link.categoryBy === 'lila' ? 'La eligió Lila al guardarlo. Tú decides.' : 'La elegiste tú.'}
        </p>
      ) : null}
      <div role="radiogroup" aria-label="Categorías" className="mt-4 space-y-2 border-t border-outline/15 pt-4">
        {categories.map((category) => (
          <ChoiceRow key={category.id} id={category.id} name={category.name} count={counts.get(category.id) ?? 0} current={current === category.id} selected={selected === category.id} onSelect={() => setSelected(category.id)} />
        ))}
        <ChoiceRow id={NO_CATEGORY} name="Sin categoría" count={counts.get(NO_CATEGORY)} current={current === NO_CATEGORY} selected={selected === NO_CATEGORY} onSelect={() => setSelected(NO_CATEGORY)} />
        <NewCategoryRow full={categories.length >= MAX_LINK_CATEGORIES} busy={busy} onCreate={create} />
      </div>
      <FieldError>{error}</FieldError>
    </Overlay>
  );
}
