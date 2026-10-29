import { useState } from 'react';
import { Archive, Building2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { CLIENTS_PAGE, CLIENTS_PREVIEW, clientRowSubtitle, formatChatTimestamp, pageLiveClients, type ClientEntry } from '@lilachat/shared';
import type { ChatSummary } from '../../chat/types';

type Entry = ClientEntry<ChatSummary>;

/**
 * «CLIENTES · N» in the space list (design f-01): one row per live client,
 * with its open services and last order, and at the end the row
 * «Archivados · N clientes · X sin leer» that opens the archived screen.
 * Hidden when the person is in no client channel. It starts with the newest
 * four (José 29/10), «Ver más» opens ten more, and past four a field filters
 * by client name or RUC.
 */
export function ClientsSection(props: { live: Entry[]; query: string; archived: number; archivedUnread: number; folded: boolean; onToggle: () => void; selectedChatId: string | null; onOpen: (chat: ChatSummary) => void; onArchived: () => void; now?: Date }) {
  const [shown, setShown] = useState(CLIENTS_PREVIEW);
  const [filter, setFilter] = useState('');
  if (props.live.length === 0 && props.archived === 0) return null;
  const now = props.now ?? new Date();
  const page = pageLiveClients(props.live, { query: props.query || filter, shown });
  return (
    <section data-testid="seccion-clientes" className="pt-1">
      <button type="button" data-testid="plegar-clientes" aria-expanded={!props.folded} onClick={props.onToggle} className="flex h-10 w-full items-center gap-1.5 px-4 text-left">
        {props.folded ? <ChevronRight size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Clientes</span>
        <span className="text-[11px] text-on-surface-variant">{props.live.length}</span>
      </button>
      {props.folded ? null : (
        <>
          {props.live.length > CLIENTS_PREVIEW && !props.query ? (
            <label className="mx-4 mb-1 flex h-8 items-center gap-2 rounded-lg bg-background px-2.5">
              <Search size={14} className="text-on-surface-variant" />
              <input data-testid="filtro-clientes" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar por cliente o RUC" aria-label="Filtrar por cliente o RUC" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
            </label>
          ) : null}
          {page.entries.map((entry) => <ClientRow key={entry.client.id} entry={entry} now={now} open={entry.client.chat_id === props.selectedChatId} onOpen={props.onOpen} />)}
          {(props.query || filter) && page.entries.length === 0 ? <p className="px-4 py-1.5 text-[12px] text-on-surface-variant">Ningún cliente con ese nombre.</p> : null}
          {page.hidden > 0 ? (
            <button type="button" data-testid="clientes-ver-mas" onClick={() => setShown((before) => before + CLIENTS_PAGE)} className="h-9 w-full px-4 text-left text-[13px] font-semibold text-primary hover:bg-background">{`Ver más · ${page.hidden}`}</button>
          ) : null}
          {props.archived > 0 ? (
            <button type="button" data-testid="clientes-archivados" onClick={props.onArchived} className="flex h-11 w-full items-center gap-2.5 px-4 text-left text-sm hover:bg-background">
              <Archive size={16} className="text-on-surface-variant" />
              <span className="min-w-0 flex-1 truncate">{`Archivados · ${props.archived} ${props.archived === 1 ? 'cliente' : 'clientes'}`}</span>
              {props.archivedUnread > 0 ? <span className="text-[12px] font-semibold text-primary">{`${props.archivedUnread} sin leer`}</span> : null}
              <ChevronRight size={16} className="text-on-surface-variant" />
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

/** A client: the building, its name (bold with something new), the services line and its time or count. */
export function ClientRow(props: { entry: Entry; now: Date; open: boolean; onOpen: (chat: ChatSummary) => void }) {
  const { client, chat } = props.entry;
  const unread = (chat?.unread ?? 0) > 0;
  return (
    <button
      type="button"
      data-testid={`cliente-fila-${client.id}`}
      aria-current={props.open}
      disabled={!chat}
      onClick={() => chat && props.onOpen(chat)}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left ${props.open ? 'bg-primary/10' : 'hover:bg-background'}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-outline/15 bg-background">
        <Building2 size={17} className={unread || props.open ? 'text-primary' : 'text-on-surface-variant'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${unread ? 'font-bold' : 'font-medium'} ${props.open ? 'text-primary' : ''}`}>{client.name}</span>
        <span className="block truncate text-[12px] text-on-surface-variant">{clientRowSubtitle(client, props.now)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {chat?.lastMessage ? <span className={`text-[11px] ${unread ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{formatChatTimestamp(chat.lastMessage.at)}</span> : null}
        {unread ? <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{chat?.unread}</span> : null}
      </span>
    </button>
  );
}
