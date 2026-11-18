import { Folder, FolderX, Pencil, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { primerEnlace, type LinkCard, type LinkNoteItem } from '@lilachat/shared';
import type { ChatMessage, ChatSummary } from '../types';
import { authorOf, dayMonthOf, LinkThumb, PlatformPill, summaryOf, useLinkPlayer } from './linkCardParts';
import { refreshLinkCard } from './linkNotesApi';
import { useLinkNotes } from './linkNotesStore';
import { MoveLinkSheet } from './MoveLinkSheet';
import { showsLinkSorting } from './notesView';

/**
 * A link inside the bubble of a notes chat with its links sorted (design
 * nl-02): the card the server stored instead of the generic preview, and
 * under it the category with a pencil to move it.
 */
export function storedLinkOf(message: Pick<ChatMessage, 'link' | 'deletedAt'>, chat: Pick<ChatSummary, 'kind' | 'linksSorted'>): LinkCard | null {
  return message.link && !message.deletedAt && showsLinkSorting(chat) ? message.link : null;
}

/** The body that is only the link says nothing the card does not say. */
export function bodyIsOnlyLink(body: string | undefined): boolean {
  const trimmed = body?.trim() ?? '';
  return Boolean(trimmed) && primerEnlace(trimmed) === trimmed;
}

type Props = { jwt: string; chatId: string; seq: number; at: string; link: LinkCard };

function StatusPills({ link, onRetry, retrying }: { link: LinkCard; onRetry: () => void; retrying: boolean }) {
  if (link.status === 'unreadable') {
    return (
      <span className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap rounded-md bg-error/10 px-1.5 py-0.5 text-[11px] font-bold uppercase text-error">No se pudo leer</span>
        <button type="button" data-testid="btn-reintentar-enlace" disabled={retrying} onClick={onRetry} className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[13px] font-semibold text-primary disabled:opacity-60">
          <RotateCw size={13} aria-hidden className={retrying ? 'motion-safe:animate-spin' : ''} /> {retrying ? 'Leyendo…' : 'Reintentar'}
        </button>
      </span>
    );
  }
  return null;
}

/** Under the author and before the description, as in design nl-02. */
function CommentBaitBadge() {
  return <span data-testid="solo-pide-comentar" className="my-1 inline-block max-w-full truncate rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-bold uppercase text-on-surface">Solo pide comentar</span>;
}

function CategoryPill({ name, onEdit, disabled }: { name: string | null; onEdit: () => void; disabled: boolean }) {
  const Icon = name ? Folder : FolderX;
  return (
    <button type="button" data-testid="pastilla-categoria" disabled={disabled} onClick={onEdit} aria-label={`Categoría: ${name ?? 'Sin categoría'}. Cambiarla`} className="mt-1.5 flex max-w-full items-center gap-1.5 rounded-full bg-black/10 px-2.5 py-1 text-[13px] font-medium disabled:opacity-70">
      <Icon size={14} aria-hidden className="shrink-0" />
      <span className="truncate">{name ?? 'Sin categoría'}</span>
      <Pencil size={12} aria-hidden className="shrink-0 opacity-80" />
    </button>
  );
}

export function StoredLinkInBubble({ jwt, chatId, seq, at, link }: Props) {
  const { state } = useLinkNotes(jwt, chatId, true);
  const player = useLinkPlayer();
  const [moving, setMoving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [problem, setProblem] = useState('');
  const notes = state.notes;
  const category = notes?.categories.find((one) => one.id === link.categoryId)?.name ?? null;
  const retry = async () => {
    setRetrying(true);
    const response = await refreshLinkCard(jwt, chatId, seq);
    setRetrying(false);
    setProblem(response.ok ? '' : response.message);
  };
  const item: LinkNoteItem = { seq, at, link };
  const unreadable = link.status === 'unreadable';
  return (
    // A fixed width like design nl-02, never wider than the bubble (E2E 18/11: a long author pushed it off screen).
    <div data-testid={`enlace-guardado-${seq}`} className="mb-1 w-80 max-w-full">
      <div className="flex gap-3 rounded-card bg-surface p-2.5 text-on-surface">
        <button type="button" aria-label="Abrir el enlace" onClick={() => player.open(link.url)} className="shrink-0">
          <LinkThumb link={link} className="aspect-[3/4] w-[72px]" />
        </button>
        <div className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <PlatformPill link={link} />
            <span className="shrink-0 text-[12px] tabular-nums text-on-surface-variant">{dayMonthOf(at)}</span>
          </span>
          <button type="button" onClick={() => player.open(link.url)} className="mt-1 block w-full text-left">
            <span className={`block text-[14px] font-bold ${unreadable ? 'line-clamp-2' : 'truncate'}`}>{unreadable ? summaryOf(link) : authorOf(link)}</span>
            {!unreadable && link.commentBait ? <CommentBaitBadge /> : null}
            {unreadable ? null : <span className={`line-clamp-2 text-[13px] leading-5 ${link.commentBait ? 'text-on-surface-variant' : 'text-on-surface/80'}`}>{summaryOf(link)}</span>}
          </button>
          <StatusPills link={link} retrying={retrying} onRetry={() => void retry()} />
          {problem ? <p className="mt-1 text-[12px] text-error">{problem}</p> : null}
        </div>
      </div>
      <CategoryPill name={category} disabled={!notes} onEdit={() => setMoving(true)} />
      {moving && notes ? <MoveLinkSheet jwt={jwt} chatId={chatId} item={item} notes={notes} onClose={() => setMoving(false)} /> : null}
      {player.overlay}
    </div>
  );
}
