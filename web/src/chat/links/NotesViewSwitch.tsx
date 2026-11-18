import { Folder, MessageSquareText, type LucideIcon } from 'lucide-react';
import type { ChatSummary } from '../types';
import { showsLinkSorting, type NotesView } from './notesView';

const OPTIONS: { view: NotesView; label: string; icon: LucideIcon }[] = [
  { view: 'chat', label: 'Chat', icon: MessageSquareText },
  { view: 'categories', label: 'Por categoría', icon: Folder },
];

/**
 * The segmented «Chat · Por categoría» (design nl-01): only in a notes chat
 * with its links sorted. In the header on a computer, full width under it on a phone.
 */
export function NotesViewSwitch(props: { chat: Pick<ChatSummary, 'kind' | 'linksSorted'>; view: NotesView; onView: (view: NotesView) => void; inHeader?: boolean }) {
  if (!showsLinkSorting(props.chat)) return null;
  return (
    <div role="tablist" aria-label="Vista del chat" data-testid="vista-de-notas" className={`flex rounded-xl border border-outline/15 bg-primary/10 p-1 ${props.inHeader ? 'w-[300px] shrink-0' : 'w-full'}`}>
      {OPTIONS.map((option) => {
        const active = props.view === option.view;
        const Icon = option.icon;
        return (
          <button
            key={option.view}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`vista-notas-${option.view}`}
            onClick={() => props.onView(option.view)}
            className={`flex min-h-[36px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm transition-colors motion-reduce:transition-none ${active ? 'bg-surface font-semibold text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <Icon size={16} aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Under the header on a phone or a narrow window. */
export function NotesViewBand(props: Parameters<typeof NotesViewSwitch>[0]) {
  if (!showsLinkSorting(props.chat)) return null;
  return (
    <div className="border-b border-outline/15 bg-surface px-4 py-2">
      <NotesViewSwitch {...props} />
    </div>
  );
}
