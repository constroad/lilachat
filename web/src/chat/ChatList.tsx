import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, MessageSquarePlus, MoreVertical, NotebookPen, Search, Settings, SquarePen, Users } from 'lucide-react';
import type { FiltroDeChats } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { FilaDeChat } from './FilaDeChat';
import { FiltrosDeLaLista } from './FiltrosDeLaLista';
import { armarLista } from './listaDeChats';
import type { AccionDelChat } from './menuDelChat';
import type { ChatSummary } from './types';

/**
 * El panel izquierdo del diseño web (W3a: `w3-web-lista.png`).
 *
 * Recibe TODOS los chats y arma lo visible acá: la principal o «Archivados»,
 * el chip activo y el buscador (`armarLista`, con los motores de la app).
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
  onNewBorrador,
  onAccion,
  yo,
}: {
  chats: ChatSummary[];
  selectedChatId: string | null;
  query: string;
  onQueryChange: (next: string) => void;
  onSelect: (chat: ChatSummary) => void;
  me: { name?: string | null; phone: string };
  onSettings: () => void;
  loading: boolean;
  onNewChat: () => void;
  onNewGroup: () => void;
  onAgenda: () => void;
  onNewBorrador: () => void;
  onAccion: (chat: ChatSummary, accion: AccionDelChat) => void;
  /** Mi id: los avisos de la vista previa en segunda persona («Fijaste…»). */
  yo?: string;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDeChats>('todos');
  const [verArchivados, setVerArchivados] = useState(false);
  const lista = useMemo(() => armarLista({ chats, filtro, texto: query, verArchivados }), [chats, filtro, query, verArchivados]);
  // Se archivó el último: «Archivados» vacío no tiene salida útil, se vuelve a la principal.
  useEffect(() => {
    if (verArchivados && lista.archivados.total === 0) setVerArchivados(false);
  }, [verArchivados, lista.archivados.total]);
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
    { id: 'agenda', label: 'Eventos y encuestas', icon: CalendarDays, run: onAgenda },
  ];

  return (
    <aside
      data-testid="panel-lista"
      className="flex h-full w-full flex-col border-r border-outline/15 bg-surface md:w-[340px] md:shrink-0 lg:w-[400px]"
    >
      <header className="flex items-center gap-2 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary">
          <span className="text-base font-bold">L</span>
        </div>
        <h1 className="flex-1 text-lg font-bold tracking-tight">Lilachat</h1>
        <button type="button" data-testid="btn-lapiz-nuevo-chat" aria-label="Nuevo chat" title="Nuevo chat" onClick={onNewChat} className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <SquarePen size={18} />
        </button>
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

      <FiltrosDeLaLista lista={lista} filtro={filtro} onFiltro={setFiltro} verArchivados={verArchivados} onArchivados={setVerArchivados} />

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
        ) : lista.visibles.length === 0 ? (
          <ListaVacia query={query} filtro={filtro} verArchivados={verArchivados} hayChats={chats.length > 0} onNewChat={onNewChat} />
        ) : (
          lista.visibles.map((chat) => (
            <FilaDeChat key={chat.id} chat={chat} yo={yo} seleccionado={chat.id === selectedChatId} onSelect={() => onSelect(chat)} onAccion={onAccion} />
          ))
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
        ? VACIO_DEL_FILTRO[props.filtro]
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
