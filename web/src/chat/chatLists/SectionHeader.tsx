import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { SectionRow } from '@lilachat/shared';

/**
 * A section's header in the chat list, like Slack's sidebar (pending 62,
 * design `r154-secciones`): the chevron says whether it is open; open, it
 * shows how many chats it has; folded, how many are unread, in the accent
 * pill. The pencil (or a right click) edits it; «Sin sección» has nothing to edit.
 */
export function SectionHeader(props: { row: SectionRow; onToggle: (sectionId: string) => void; onEdit?: (listId: string) => void }) {
  const { row, onEdit } = props;
  const Chevron = row.collapsed ? ChevronRight : ChevronDown;
  const showUnread = row.collapsed && row.unread > 0;
  const listId = row.listId;
  return (
    <div className="group mt-1 flex items-center bg-primary/[0.05] pr-2" onContextMenu={(event) => {
      if (!listId || !onEdit) return;
      event.preventDefault();
      onEdit(listId);
    }}>
      <button
        type="button"
        data-testid={`seccion-${row.sectionId}`}
        aria-expanded={!row.collapsed}
        onClick={() => props.onToggle(row.sectionId)}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 px-4 text-left"
      >
        <Chevron size={16} className="shrink-0 text-on-surface-variant" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold uppercase tracking-[0.15em]">{row.title}</span>
        {showUnread ? (
          <span data-testid={`seccion-sin-leer-${row.sectionId}`} className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-on-primary">{row.unread}</span>
        ) : (
          <span className="text-[12px] tabular-nums text-on-surface-variant">{row.count}</span>
        )}
      </button>
      {listId && onEdit ? (
        <button type="button" data-testid={`editar-seccion-${row.sectionId}`} aria-label={`Editar la sección ${row.title}`} title="Editar sección" onClick={() => onEdit(listId)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-on-surface-variant opacity-0 hover:bg-background focus:opacity-100 group-hover:opacity-100">
          <Pencil size={14} />
        </button>
      ) : null}
    </div>
  );
}
