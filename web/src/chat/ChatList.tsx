import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ListTodo, MessageSquarePlus, MoreVertical, NotebookPen, PanelLeftClose, Search, Settings, SquarePen, Star, Users } from 'lucide-react';
import type { FiltroDeChats } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ChatRow } from './FilaDeChat';
import { FiltrosDeLaLista } from './FiltrosDeLaLista';
import { buildChatList } from './listaDeChats';
import { useChatListsPanel } from './chatLists/useChatListsPanel';
import { useChatSectionsWeb } from './chatLists/useChatSectionsWeb';
import { SectionHeader } from './chatLists/SectionHeader';
import type { ChatAction } from './menuDelChat';
import type { ChatSummary } from './types';
import { NewVersionBand } from '../ui/NewVersionBand';
import { NowPlayingBar } from './NowPlayingBar';

/**
 * El panel izquierdo del diseño web (W3a: `w3-web-lista.png`).
 *
 * Recibe TODOS los chats y arma lo visible acá: la principal o «Archivados»,
 * the active chip and the search, with the app's engines (`buildChatList`).
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
  onNewChat,
  onNewGroup,
  onAgenda,
  onDestacados,
  onNewBorrador,
  onAccion,
  yo,
  width,
  onCollapse,
  onHome,
  onSpaces,
  jwt,
}: {
  chats: ChatSummary[];
  selectedChatId: string | null;
  query: string;
  onQueryChange: (next: string) => void;
  onSelect: (chat: ChatSummary) => void;
  /** The foot with me and «Ajustes»: only without the rail, which carries both (pending 38). */
  me?: { name?: string | null; phone: string };
  onSettings?: () => void;
  loading: boolean;
  onNewChat: () => void;
  onNewGroup: () => void;
  onAgenda: () => void;
  /** Los mensajes que destaqué, de todos los chats (20/10). */
  onDestacados?: () => void;
  onNewBorrador: () => void;
  onAccion: (chat: ChatSummary, accion: ChatAction) => void;
  /** Mi id: los avisos de la vista previa en segunda persona («Fijaste…»). */
  yo?: string;
  /** Its width when the parent lets you drag it (two panels); without it, the usual widths. */
  width?: number;
  /** Folds the list into a rail (José, 21/10). */
  onCollapse?: () => void;
  /** The logo: back to the list with no chat open. */
  onHome?: () => void;
  /** «Cambiar de espacio» (E1, design `e1-06`): the arrow next to the name, like the app's header. */
  onSpaces?: () => void;
  /** The session, for my lists of chats (pending 45). */
  jwt: string;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDeChats>('todos');
  const [verArchivados, setVerArchivados] = useState(false);
  const myLists = useChatListsPanel({ jwt, chats });
  const shown = useMemo(() => buildChatList({ chats, filtro, texto: query, verArchivados }), [chats, filtro, query, verArchivados]);
  // Slack's sections (pending 62): my lists fold the «Todos» list; a filter or a search shows it flat.
  const sections = useChatSectionsWeb({ userId: yo ?? '', chats: shown.visibles, lists: myLists.lists, enabled: filtro === 'todos' && !query.trim() && !verArchivados });
  const onRowAction = (chat: ChatSummary, accion: ChatAction) => (accion === 'lista' ? myLists.openAddTo(chat) : onAccion(chat, accion));
  // Se archivó el último: «Archivados» vacío no tiene salida útil, se vuelve a la principal.
  useEffect(() => {
    if (verArchivados && shown.archivados.total === 0) setVerArchivados(false);
  }, [verArchivados, shown.archivados.total]);
  const menuRef = useRef<HTMLDivElement>(null);

  // Un menú que solo se cierra con su propio botón queda abierto encima de la
  // lista mientras la persona intenta tocar un chat.
  useEffect(() => {
    if (!menuAbierto) return;
    const alTocarAfuera = (evento: MouseEvent) => {
      if (!menuRef.current?.contains(evento.target as Node)) setMenuAbierto(false);
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('mousedown', alTocarAfuera);
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('mousedown', alTocarAfuera);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [menuAbierto]);

  const acciones = [
    { id: 'nuevo-chat', label: 'Nuevo chat', icon: MessageSquarePlus, run: onNewChat },
    { id: 'nuevo-grupo', label: 'Nuevo grupo', icon: Users, run: onNewGroup },
    { id: 'nuevo-borrador', label: 'Nuevo borrador', icon: NotebookPen, run: onNewBorrador },
    { id: 'agenda', label: 'Pendientes y encuestas', icon: ListTodo, run: onAgenda },
    ...(onDestacados ? [{ id: 'destacados', label: 'Mensajes destacados', icon: Star, run: onDestacados }] : []),
  ];

  return (
    <aside
      data-testid="panel-lista"
      className={`flex h-full w-full min-w-0 flex-col bg-surface ${width ? 'shrink-0' : 'border-r border-outline/15 md:w-[340px] md:shrink-0 lg:w-[400px]'}`}
      style={width ? { width } : undefined}
    >
      <header className="flex items-center gap-2 px-4 py-3">
        {/* The logo goes home: the chat list with nothing open, like WhatsApp Web (José, 21/10). */}
        <a href="/" data-testid="logo-inicio" aria-label="Ir al inicio" onClick={(event) => { if (!onHome) return; event.preventDefault(); onHome(); }} className={`flex items-center gap-2 rounded-lg ${onSpaces ? '' : 'flex-1'}`}>
          <Logo size={30} />
          <h1 className="text-lg font-extrabold tracking-tight">Lilachat</h1>
        </a>
        {onSpaces ? (
          <button type="button" data-testid="btn-espacios" aria-label="Cambiar de espacio" title="Cambiar de espacio" onClick={onSpaces} className="-ml-2 mr-auto grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <ChevronDown size={18} />
          </button>
        ) : null}
        <ThemeToggle />
        <button type="button" data-testid="btn-lapiz-nuevo-chat" aria-label="Nuevo chat" title="Nuevo chat" onClick={onNewChat} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <SquarePen size={18} />
        </button>
        {onCollapse ? (
          <button type="button" data-testid="btn-plegar-lista" aria-label="Plegar la lista" title="Plegar la lista" onClick={onCollapse} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <PanelLeftClose size={18} />
          </button>
        ) : null}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            data-testid="btn-menu"
            aria-label="Menú"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background"
          >
            <MoreVertical size={18} />
          </button>

          {menuAbierto ? (
            <div
              data-testid="menu-crear"
              className="absolute right-0 top-10 z-20 w-56 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg"
            >
              {acciones.map((accion) => (
                <button
                  key={accion.id}
                  type="button"
                  data-testid={`btn-${accion.id}`}
                  onClick={() => {
                    setMenuAbierto(false);
                    accion.run();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-background"
                >
                  <accion.icon size={16} className="shrink-0 text-on-surface-variant" />
                  {accion.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {/* A voice note that keeps playing in another chat (backlog 34). */}
      <NowPlayingBar
        openChatId={selectedChatId}
        onOpen={(chatId) => {
          const chat = chats.find((one) => one.id === chatId);
          if (chat) onSelect(chat);
        }}
      />
      <NewVersionBand />

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

      <FiltrosDeLaLista lista={shown} filtro={filtro} onFiltro={setFiltro} verArchivados={verArchivados} onArchivados={setVerArchivados} onNuevaLista={myLists.openNew} />
      {myLists.dialogs}

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
        ) : shown.visibles.length === 0 ? (
          <ListaVacia query={query} filtro={filtro} verArchivados={verArchivados} hayChats={chats.length > 0} onNewChat={onNewChat} />
        ) : (
          sections.rows.map((row) =>
            row.type === 'section' ? (
              <SectionHeader key={row.key} row={row} onToggle={sections.toggle} onEdit={myLists.openEdit} />
            ) : (
              <ChatRow key={row.key} chat={row.chat} yo={yo} seleccionado={row.chat.id === selectedChatId} onSelect={() => onSelect(row.chat)} onAccion={onRowAction} />
            )
          )
        )}
      </div>

      {me && onSettings ? (
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
      ) : null}
    </aside>
  );
}

const VACIO_DEL_FILTRO: Record<FiltroDeChats, string> = {
  todos: 'Todavía no tienes conversaciones.',
  'no-leidos': 'No tienes chats sin leer.',
  grupos: 'Todavía no estás en ningún grupo.',
  borradores: 'No tienes borradores. Créalos desde el menú: son chats contigo, con nombre.',
};

/** Tres vacíos distintos: sin chats, sin coincidencias y sin nada en el filtro. */
function ListaVacia(props: { query: string; filtro: FiltroDeChats; verArchivados: boolean; hayChats: boolean; onNewChat: () => void }) {
  const texto = props.query
    ? 'Ninguna conversación coincide con lo que buscas.'
    : props.verArchivados
      ? 'No hay chats archivados.'
      : props.hayChats
        ? (VACIO_DEL_FILTRO[props.filtro] ?? 'Esta lista no tiene chats. Agrégalos desde el menú de cada chat o con el lápiz.')
        : VACIO_DEL_FILTRO.todos;
  return (
    <div className="px-6 pt-8 text-center">
      <p className="text-sm leading-5 text-on-surface-variant">{texto}</p>
      {/* El vacío sin salida es el que vio José: la lista decía que no hay
          nada y no ofrecía cómo empezar. */}
      {props.query || props.hayChats ? null : (
        <button
          type="button"
          data-testid="btn-empezar-chat"
          onClick={props.onNewChat}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          <MessageSquarePlus size={16} /> Empezar un chat
        </button>
      )}
    </div>
  );
}
