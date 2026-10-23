import { Archive, ArrowLeft, Pencil, Plus } from 'lucide-react';
import { listFilter, listIdOf, type ChatList, type FiltroDeChats } from '@lilachat/shared';
import type { ListaArmada } from './listaDeChats';

/**
 * Los chips de la lista y la fila «Archivados» (W3a). En «Archivados» los chips
 * se van: la cabecera dice dónde se está y cómo volver.
 */
const CHIPS: { filtro: FiltroDeChats; etiqueta: string; cuenta?: keyof ListaArmada['cuentas'] }[] = [
  { filtro: 'todos', etiqueta: 'Todos' },
  { filtro: 'no-leidos', etiqueta: 'No leídos', cuenta: 'no-leidos' },
  { filtro: 'grupos', etiqueta: 'Grupos', cuenta: 'grupos' },
  { filtro: 'borradores', etiqueta: 'Borradores', cuenta: 'borradores' },
];

export function FiltrosDeLaLista(props: {
  lista: ListaArmada;
  filtro: FiltroDeChats;
  onFiltro: (filtro: FiltroDeChats) => void;
  verArchivados: boolean;
  onArchivados: (ver: boolean) => void;
  /** Lists of my own (pending 45): a chip each; right click or the pencil edits the one open. */
  listas?: readonly ChatList[];
  onNuevaLista?: () => void;
  onEditarLista?: (listId: string) => void;
}) {
  if (props.verArchivados) {
    return (
      <div className="flex items-center gap-2 border-b border-outline/10 px-2 pb-2">
        <button type="button" data-testid="btn-salir-archivados" aria-label="Volver a los chats" onClick={() => props.onArchivados(false)} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-base font-bold">Archivados</h2>
      </div>
    );
  }
  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
        {[...CHIPS, ...(props.listas ?? []).map((lista) => ({ filtro: listFilter(lista.id), etiqueta: lista.name, cuenta: undefined }))].map((chip) => {
          const activo = props.filtro === chip.filtro;
          const cuenta = chip.cuenta ? props.lista.cuentas[chip.cuenta] : 0;
          return (
            <button
              key={chip.filtro}
              type="button"
              data-testid={`filtro-${chip.filtro}`}
              aria-pressed={activo}
              onClick={() => props.onFiltro(chip.filtro)}
              onContextMenu={(event) => {
                const listId = listIdOf(chip.filtro);
                if (!listId || !props.onEditarLista) return;
                event.preventDefault();
                props.onEditarLista(listId);
              }}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                activo ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-transparent bg-background text-on-surface hover:bg-primary/5'
              }`}
            >
              {chip.etiqueta}
              {cuenta > 0 ? <span className="tabular-nums">{cuenta}</span> : null}
            </button>
          );
        })}
        {listIdOf(props.filtro) && props.onEditarLista ? (
          <button type="button" data-testid="btn-editar-lista" aria-label="Editar lista" title="Editar lista" onClick={() => props.onEditarLista?.(listIdOf(props.filtro)!)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-background text-on-surface-variant hover:bg-primary/5">
            <Pencil size={14} />
          </button>
        ) : null}
        {props.onNuevaLista ? (
          <button type="button" data-testid="filtro-nueva-lista" aria-label="Nueva lista" title="Nueva lista" onClick={props.onNuevaLista} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-background text-on-surface hover:bg-primary/5">
            <Plus size={16} />
          </button>
        ) : null}
      </div>
      {props.lista.archivados.total > 0 ? (
        <button type="button" data-testid="fila-archivados" onClick={() => props.onArchivados(true)} className="flex w-full items-center gap-4 border-y border-outline/10 px-6 py-3 text-left text-sm hover:bg-background">
          <Archive size={18} className="text-on-surface-variant" />
          <span className="flex-1 font-medium">Archivados</span>
          <span className={`text-xs tabular-nums ${props.lista.archivados.sinLeer > 0 ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>
            {props.lista.archivados.sinLeer > 0 ? props.lista.archivados.sinLeer : props.lista.archivados.total}
          </span>
        </button>
      ) : null}
    </>
  );
}
