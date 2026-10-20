import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { formatChatTimestamp, textoDelDestacado, type DestacadoEnLista } from '@lilachat/shared';
import { api } from '../../api';
import { Overlay } from '../../ui/Overlay';

const nombreDe = (persona: { name?: string; phone?: string }) => persona.name ?? persona.phone ?? 'Alguien';

/**
 * Los mensajes que destaqué (20/10), como la app: los de un chat (desde su
 * info) o todos (desde el menú de la lista). Clic lleva al mensaje; la estrella
 * lo quita.
 */
export function ListaDeDestacados(props: { jwt: string; yo: string; chatId?: string; onIr: (destacado: DestacadoEnLista) => void; onCerrar: () => void; onCambio?: () => void }) {
  const [lista, setLista] = useState<DestacadoEnLista[] | null>(null);
  const [fallo, setFallo] = useState('');
  const { jwt, chatId } = props;

  useEffect(() => {
    void api<{ destacados: DestacadoEnLista[] }>('/destacados', { jwt }).then((respuesta) => {
      if (!respuesta.ok) return setFallo(respuesta.message);
      setLista(respuesta.data.destacados.filter((destacado) => !chatId || destacado.chatId === chatId));
    });
  }, [jwt, chatId]);

  const quitar = async (destacado: DestacadoEnLista) => {
    setLista((antes) => antes?.filter((uno) => uno !== destacado) ?? antes);
    const respuesta = await api(`/chats/${destacado.chatId}/destacados/${destacado.seq}`, { method: 'DELETE', jwt });
    if (!respuesta.ok) setLista((antes) => (antes ? [destacado, ...antes] : antes));
    else props.onCambio?.();
  };

  return (
    <Overlay title={`Mensajes destacados${lista ? ` · ${lista.length}` : ''}`} onClose={props.onCerrar}>
      {fallo ? <p role="alert" className="py-4 text-center text-sm text-error">{fallo}</p> : null}
      {lista === null && !fallo ? <div className="h-14 animate-pulse rounded-xl bg-background" /> : null}
      {lista?.length === 0 ? (
        <div data-testid="destacados-vacio" className="py-8 text-center">
          <Star size={26} className="mx-auto text-primary" />
          <p className="mt-2 text-sm font-semibold">Sin mensajes destacados</p>
          <p className="mt-1 text-[13px] text-on-surface-variant">Abre el menú de un mensaje y elige «Destacar». Solo tú lo ves.</p>
        </div>
      ) : null}
      <ul className="divide-y divide-outline/10">
        {lista?.map((destacado) => {
          const clave = `${destacado.chatId}-${destacado.seq}`;
          const autor = destacado.autor.id === props.yo ? 'Tú' : nombreDe(destacado.autor);
          return (
            <li key={clave} className="flex items-center gap-2">
              <button type="button" data-testid={`fila-destacado-${clave}`} onClick={() => { props.onCerrar(); props.onIr(destacado); }} className="min-h-[56px] min-w-0 flex-1 rounded-lg px-1 py-2 text-left hover:bg-background">
                <span className="block truncate text-[12px] text-on-surface-variant">{props.chatId ? autor : `${autor} · ${nombreDe(destacado.chat)}`}</span>
                <span className="line-clamp-2 block text-sm">{textoDelDestacado(destacado.mensaje)}</span>
              </button>
              <span className="shrink-0 text-[11px] text-on-surface-variant">{destacado.mensaje.at ? formatChatTimestamp(destacado.mensaje.at) : ''}</span>
              <button type="button" data-testid={`quitar-destacado-${clave}`} aria-label="Quitar de destacados" title="Quitar de destacados" onClick={() => void quitar(destacado)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary hover:bg-background">
                <Star size={16} fill="currentColor" />
              </button>
            </li>
          );
        })}
      </ul>
    </Overlay>
  );
}
