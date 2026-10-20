import { Forward, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { alternarDestino, destinosDeReenvio, MAXIMO_DE_DESTINOS, type ChatParaReenviar } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { Overlay } from '../../ui/Overlay';
import type { ChatSummary } from '../types';
import { leerFrecuencias } from './frecuenciasDeEnvio';

/** El «Tú» que todavía no existe: se crea al mandar (`kind: 'yo'`). */
export const TU_NUEVO = 'tu-nuevo';

function destinosPosibles(chats: readonly ChatSummary[]): ChatParaReenviar[] {
  const lista = chats.map((chat) => ({
    id: chat.id,
    nombre: chat.propio ? 'Tú' : (chat.name ?? chat.phone ?? 'Conversación'),
    subtitulo: chat.propio ? 'Envíate un mensaje' : chat.kind === 'notas' ? 'Solo tú lo ves' : chat.lastMessage?.body?.split('\n')[0],
    esGrupo: chat.kind === 'group',
    esBorrador: chat.kind === 'notas' && !chat.propio,
    propio: chat.propio,
    cifrado: chat.encrypted,
    ultimoEn: chat.lastMessage?.at,
    avatarUrl: chat.avatarUrl,
  }));
  return lista.some((chat) => chat.propio) ? lista : [...lista, { id: TU_NUEVO, nombre: 'Tú', subtitulo: 'Envíate un mensaje', propio: true }];
}

/**
 * Reenviar mensaje (José, 20/10; diseño `f1-web-reacciones-reenviar`), como
 * WhatsApp: buscador, «Chats frecuentes», «Chats recientes», hasta 5 con su
 * casilla, «Para:» con los elegidos, «Añadir un mensaje…» y Enviar.
 */
export function DialogoReenviar(props: { chats: ChatSummary[]; onReenviar: (chatIds: string[], mensaje: string) => void; onCerrar: () => void; onAviso: (texto: string) => void }) {
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  const posibles = useMemo(() => destinosPosibles(props.chats), [props.chats]);
  const frecuencias = useMemo(() => leerFrecuencias(), []);
  const { frecuentes, recientes } = destinosDeReenvio({ chats: posibles, frecuencias, busqueda, ahora: Date.now() });
  const nombreDe = (id: string) => posibles.find((chat) => chat.id === id)?.nombre ?? '';
  const alternar = (id: string) => {
    const r = alternarDestino(elegidos, id);
    if (r.lleno) props.onAviso(`Puedes reenviar a ${MAXIMO_DE_DESTINOS} chats como máximo.`);
    setElegidos(r.elegidos);
  };
  const seccion = (titulo: string, lista: ChatParaReenviar[]) =>
    lista.length ? (
      <>
        <p className="px-1 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">{titulo}</p>
        <ul>
          {lista.map((chat) => (
            <li key={chat.id}>
              <label className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-background">
                <Avatar name={chat.nombre} kind={chat.esGrupo ? 'group' : chat.esBorrador ? 'notas' : 'direct'} foto={chat.avatarUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{chat.nombre}</span>
                  {chat.subtitulo ? <span className="block truncate text-[12px] text-on-surface-variant">{chat.subtitulo}</span> : null}
                </span>
                <input type="checkbox" data-testid={`destino-${chat.id}`} checked={elegidos.includes(chat.id)} onChange={() => alternar(chat.id)} className="h-5 w-5 accent-primary" />
              </label>
            </li>
          ))}
        </ul>
      </>
    ) : null;

  return (
    <Overlay
      title="Reenviar mensaje"
      onClose={props.onCerrar}
      footer={
        <div data-testid="pie-reenviar" className="flex flex-col gap-2">
          {elegidos.length ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-on-surface-variant">Para:</span>
              {elegidos.map((id) => (
                <button key={id} type="button" data-testid={`elegido-${id}`} onClick={() => alternar(id)} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                  {nombreDe(id)} <X size={12} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input data-testid="input-mensaje-reenviar" value={mensaje} onChange={(evento) => setMensaje(evento.target.value)} placeholder="Añadir un mensaje…" className="min-h-[44px] flex-1 rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
            <button type="button" data-testid="btn-reenviar" disabled={elegidos.length === 0} onClick={() => props.onReenviar(elegidos, mensaje.trim())} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">
              Enviar <Forward size={16} />
            </button>
          </div>
        </div>
      }
    >
      <p className="-mt-2 mb-2 text-[12px] text-on-surface-variant">{elegidos.length === 1 ? '1 seleccionado' : `${elegidos.length} seleccionados`}</p>
      <label className="flex min-h-[44px] items-center gap-2 rounded-xl bg-background px-3">
        <Search size={16} className="text-on-surface-variant" />
        <input data-testid="buscar-reenviar" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar chats o contactos…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      {seccion('Chats frecuentes', frecuentes)}
      {seccion(busqueda ? 'Resultados' : 'Chats recientes', recientes)}
      {!frecuentes.length && !recientes.length ? <p className="py-6 text-center text-sm text-on-surface-variant">No hay chats con ese nombre.</p> : null}
    </Overlay>
  );
}
