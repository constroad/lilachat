import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, Info, Search, X } from 'lucide-react';
import { ARCHIVED_RULE, CLIENT_LIVE_DAYS, filterArchivedClients, openServices, resolveChatPreview, shortDate, type ArchivedClientsFilter, type ClientEntry } from '@lilachat/shared';
import type { ChatSummary } from '../../chat/types';

type Entry = ClientEntry<ChatSummary>;
const CHIPS: { key: ArchivedClientsFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'Sin leer' },
  { key: 'recent', label: 'Último pedido < 6 meses' },
];

const lastLine = (chat: ChatSummary | null) => (chat?.lastMessage ? resolveChatPreview({ typing: false, lastBody: chat.lastMessage.body, lastKind: chat.lastMessage.kind, lastMime: chat.lastMessage.mime, eliminado: Boolean(chat.lastMessage.deletedAt), enHilo: chat.lastMessage.hiloDe !== undefined }).text : '');

/**
 * «Archivados» of the clients (design f-02): the rule, a search by name or
 * RUC, the chips and the groups by age. A table on a computer (desktop
 * design, without its invented «Espacio conectado»), rows on a phone.
 */
export function ArchivedClients(props: { archived: Entry[]; onOpen: (chat: ChatSummary) => void; onClose: () => void; now?: Date }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ArchivedClientsFilter>('all');
  const now = useMemo(() => props.now ?? new Date(), [props.now]);
  const view = useMemo(() => filterArchivedClients(props.archived, { query, filter }, now), [props.archived, query, filter, now]);
  const { onClose } = props;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const open = (entry: Entry) => entry.chat && props.onOpen(entry.chat);

  return (
    <div className="fixed inset-0 z-30 bg-black/40 md:p-6" onClick={props.onClose}>
      <div role="dialog" aria-label="Clientes archivados" data-testid="clientes-archivados-pantalla" onClick={(event) => event.stopPropagation()} className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-background md:rounded-2xl">
        <header className="flex items-start gap-3 border-b border-outline/15 bg-surface px-4 py-4 md:px-8 md:py-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Clientes</p>
            <h2 className="mt-1 flex flex-wrap items-baseline gap-x-3 text-2xl font-extrabold tracking-tight">
              Archivados
              <span className="text-sm font-normal text-on-surface-variant">{`${props.archived.length} ${props.archived.length === 1 ? 'cliente' : 'clientes'} sin movimiento en ${CLIENT_LIVE_DAYS} días`}</span>
            </h2>
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-outline/15 bg-surface px-3 py-2 text-[13px] text-on-surface-variant"><Info size={15} className="mt-0.5 shrink-0 text-primary" />{ARCHIVED_RULE}</p>
          </div>
          <button type="button" data-testid="cerrar-archivados" aria-label="Cerrar" onClick={props.onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={20} /></button>
        </header>
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:px-8">
          <label className="flex items-center gap-2 rounded-xl border border-outline/20 bg-surface px-3 py-2 md:w-80">
            <Search size={16} className="shrink-0 text-on-surface-variant" />
            <input data-testid="buscar-archivados" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente o RUC…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant" />
          </label>
          <div className="flex gap-2 overflow-x-auto">
            {CHIPS.map((chip) => (
              <button key={chip.key} type="button" data-testid={`chip-archivados-${chip.key}`} aria-pressed={filter === chip.key} onClick={() => setFilter(chip.key)} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm ${filter === chip.key ? 'bg-primary font-semibold text-on-primary' : 'border border-outline/20 bg-surface'}`}>
                {chip.label}
                <span className={`text-[11px] font-bold ${filter === chip.key ? '' : 'text-primary'}`}>{view.counts[chip.key]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-8">
          {view.groups.length === 0 ? <p data-testid="archivados-vacio" className="pt-10 text-center text-sm text-on-surface-variant">Ningún cliente archivado coincide.</p> : null}
          {view.groups.map((group) => (
            <section key={group.key} data-testid={`grupo-archivados-${group.key}`} className="mb-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
              <p className="border-b border-outline/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{`${group.title} · ${group.entries.length}`}</p>
              <table className="hidden w-full text-left text-sm md:table">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                  <tr><th className="px-4 py-2 font-bold">Cliente</th><th className="px-2 font-bold">Último pedido</th><th className="px-2 text-right font-bold">Pedidos</th><th className="px-2 text-right font-bold">Servicios</th><th className="px-4 font-bold">Último mensaje</th><th className="px-2 font-bold">Archivado</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-outline/10">
                  {group.entries.map((entry) => (
                    <tr key={entry.client.id} data-testid={`archivado-fila-${entry.client.id}`} onClick={() => open(entry)} className="cursor-pointer hover:bg-background">
                      <td className="px-4 py-3"><ClientName entry={entry} /></td>
                      <td className="px-2 font-mono text-[13px]">{entry.client.last_order_at ? shortDate(entry.client.last_order_at) : '—'}</td>
                      <td className="px-2 text-right font-semibold tabular-nums">{entry.client.orders_total}</td>
                      <td className="px-2 text-right font-mono tabular-nums text-on-surface-variant">{openServices(entry.client)}</td>
                      <td className={`max-w-[280px] truncate px-4 ${(entry.chat?.unread ?? 0) > 0 ? 'font-semibold' : 'text-on-surface-variant'}`}>{lastLine(entry.chat)}</td>
                      <td className="px-2 font-mono text-[13px] text-on-surface-variant">{entry.client.archived_since ? shortDate(entry.client.archived_since) : '—'}</td>
                      <td className="pr-3"><ChevronRight size={16} className="text-on-surface-variant" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divide-y divide-outline/10 md:hidden">
                {group.entries.map((entry) => (
                  <button key={entry.client.id} type="button" data-testid={`archivado-tarjeta-${entry.client.id}`} onClick={() => open(entry)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <ClientName entry={entry} />
                    <span className="ml-auto shrink-0 text-right text-[11px] text-on-surface-variant">{entry.client.last_order_at ? `Último pedido ${shortDate(entry.client.last_order_at)}` : 'Sin pedidos'}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {view.shown > 0 ? <p className="text-center text-[12px] text-on-surface-variant">{`Mostrando ${view.shown} de ${props.archived.length}`}</p> : null}
        </div>
      </div>
    </div>
  );
}

function ClientName(props: { entry: Entry }) {
  const { client, chat } = props.entry;
  const unread = chat?.unread ?? 0;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-outline/15 bg-background"><Building2 size={17} className="text-on-surface-variant" /></span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5"><span className={`truncate ${unread > 0 ? 'font-bold' : 'font-semibold'}`}>{client.name}</span>{unread > 0 ? <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{unread}</span> : null}</span>
        {client.ruc ? <span className="block font-mono text-[12px] text-on-surface-variant">{`RUC ${client.ruc}`}</span> : null}
      </span>
    </span>
  );
}
