import { MoreVertical, Search, Settings } from 'lucide-react';
import { formatChatTimestamp, resolveChatPreview } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import type { ChatSummary } from './types';

/**
 * El panel izquierdo del diseño web.
 *
 * Composición, de arriba abajo: cabecera con la marca y el menú, buscador de
 * ancho completo, la lista, y AL PIE una banda fija con mi propio perfil y el
 * engranaje. El pie es parte del panel, no de la lista: si scrolleara con los
 * chats, salir de la cuenta desaparecería en cuanto hubiera diez conversaciones.
 */
export function ChatList({
  chats,
  selectedChatId,
  query,
  onQueryChange,
  onSelect,
  me,
  onSettings,
  loading,
}: {
  chats: ChatSummary[];
  selectedChatId: string | null;
  query: string;
  onQueryChange: (next: string) => void;
  onSelect: (chat: ChatSummary) => void;
  me: { name?: string | null; phone: string };
  onSettings: () => void;
  loading: boolean;
}) {
  return (
    <aside
      data-testid="panel-lista"
      className="flex h-full w-full flex-col border-r border-outline/15 bg-surface md:w-[320px] md:shrink-0"
    >
      <header className="flex items-center gap-2 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary">
          <span className="text-base font-bold">L</span>
        </div>
        <h1 className="flex-1 text-lg font-bold tracking-tight">Lilachat</h1>
        <button
          type="button"
          aria-label="Menú"
          className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background"
        >
          <MoreVertical size={18} />
        </button>
      </header>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-full bg-background px-3 py-2">
          <Search size={16} className="shrink-0 text-on-surface-variant" />
          <input
            data-testid="buscar-chats"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar chats"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          // Skeleton con la geometría real de la fila: sin esto la lista salta
          // cuando llegan los datos.
          <div className="px-3 pt-1" data-testid="lista-cargando">
            {[0, 1, 2].map((index) => (
              <div key={index} className="mb-1 flex items-center gap-3 px-1 py-2.5">
                <div className="h-10 w-10 animate-pulse rounded-full bg-background" />
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-background" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-background" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <p className="px-6 pt-8 text-center text-sm leading-5 text-on-surface-variant">
            {query
              ? 'Ninguna conversación coincide con lo que buscas.'
              : 'Todavía no tienes conversaciones.'}
          </p>
        ) : (
          chats.map((chat) => {
            const selected = chat.id === selectedChatId;
            const preview = resolveChatPreview({
              typing: Boolean(chat.typingName),
              lastBody: chat.lastMessage?.body,
              lastKind: chat.lastMessage?.kind,
            });
            return (
              <button
                key={chat.id}
                type="button"
                data-testid={`chat-${chat.id}`}
                aria-current={selected}
                onClick={() => onSelect(chat)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  selected ? 'bg-primary/10' : 'hover:bg-background'
                }`}
              >
                <Avatar name={chat.name} kind={chat.kind} online={chat.online} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {chat.name ?? 'Conversación'}
                    </span>
                    {chat.lastMessage ? (
                      <span className="shrink-0 text-[11px] text-on-surface-variant">
                        {formatChatTimestamp(chat.lastMessage.at)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${
                        preview.style === 'typing'
                          ? 'italic text-primary'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      {preview.text}
                    </span>
                    {chat.unread > 0 ? (
                      <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">
                        {chat.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-outline/15 bg-primary/5 px-4 py-3">
        <Avatar name={me.name ?? me.phone} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.name ?? me.phone}</p>
          <p className="text-[11px] text-on-surface-variant">En línea</p>
        </div>
        <button
          type="button"
          data-testid="btn-ajustes"
          aria-label="Ajustes"
          onClick={onSettings}
          className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface"
        >
          <Settings size={18} />
        </button>
      </footer>
    </aside>
  );
}
