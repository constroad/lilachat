import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { puedeEliminar } from '@lilachat/shared';
import { api } from '../api';
import { Avatar } from '../ui/Avatar';
import { Overlay, PrimaryButton } from '../ui/Overlay';
import type { ResultadoDeAccion } from '../sync/envioPorSocket';
import type { ChatSummary, MensajeEnPantalla } from './types';

const BOTON_SECUNDARIO = 'flex min-h-[44px] w-full items-center justify-center rounded-xl border border-outline/25 px-4 text-sm font-semibold hover:bg-background';

/** Eliminar, como WhatsApp: «para todos» solo lo propio; «para mí» siempre. */
export function DialogoEliminar(props: {
  mensaje: MensajeEnPantalla;
  yo: string;
  onParaTodos: () => Promise<ResultadoDeAccion>;
  onParaMi: () => Promise<void>;
  onCerrar: () => void;
  onAviso: (texto: string) => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const paraTodos = puedeEliminar({ yo: props.yo, autor: props.mensaje.senderId, yaEliminado: Boolean(props.mensaje.deletedAt) }).permitido;
  const hacer = async (accion: () => Promise<ResultadoDeAccion | void>) => {
    setTrabajando(true);
    const resultado = await accion();
    props.onCerrar();
    if (resultado && !resultado.ok) props.onAviso(resultado.motivo);
  };
  return (
    <Overlay title="¿Eliminar el mensaje?" onClose={props.onCerrar}>
      <div className="flex flex-col gap-2">
        {paraTodos ? (
          <button type="button" data-testid="btn-eliminar-para-todos" disabled={trabajando} onClick={() => void hacer(props.onParaTodos)} className={`${BOTON_SECUNDARIO} text-error`}>
            Eliminar para todos
          </button>
        ) : null}
        <button type="button" data-testid="btn-eliminar-para-mi" disabled={trabajando} onClick={() => void hacer(props.onParaMi)} className={BOTON_SECUNDARIO}>
          Eliminar para mí
        </button>
        <p className="pt-1 text-center text-[12px] text-on-surface-variant">«Para mí» lo oculta solo en este navegador.</p>
      </div>
    </Overlay>
  );
}

/** Reenviar un texto a uno o varios chats. Los secretos no: llegaría en claro. */
export function DialogoReenviar(props: { mensaje: MensajeEnPantalla; chats: ChatSummary[]; onReenviar: (chatIds: string[]) => void; onCerrar: () => void }) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const destinos = useMemo(() => {
    const aguja = busqueda.trim().toLowerCase();
    return props.chats.filter((chat) => !chat.encrypted && (!aguja || (chat.name ?? chat.phone ?? '').toLowerCase().includes(aguja)));
  }, [props.chats, busqueda]);
  const alternar = (id: string) =>
    setElegidos((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  return (
    <Overlay
      title="Reenviar a…"
      onClose={props.onCerrar}
      footer={<PrimaryButton testId="btn-reenviar" disabled={elegidos.size === 0} onClick={() => props.onReenviar([...elegidos])}>{elegidos.size > 0 ? `Enviar a ${elegidos.size}` : 'Elige a quién'}</PrimaryButton>}
    >
      <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar un chat" className="mb-3 min-h-[44px] w-full rounded-lg border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
      <ul className="flex flex-col">
        {destinos.map((chat) => (
          <li key={chat.id}>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-background">
              <input type="checkbox" data-testid={`destino-${chat.id}`} checked={elegidos.has(chat.id)} onChange={() => alternar(chat.id)} className="h-4 w-4 accent-primary" />
              <Avatar name={chat.name ?? chat.phone} kind={chat.kind} foto={chat.avatarUrl} size={36} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{chat.name ?? chat.phone ?? 'Conversación'}</span>
            </label>
          </li>
        ))}
      </ul>
    </Overlay>
  );
}

type MiembroDeInfo = { id: string; name: string | null; phone: string | null; estado: 'pending' | 'sent' | 'delivered' | 'read' };
const GRUPOS: { estado: MiembroDeInfo['estado']; titulo: string }[] = [
  { estado: 'read', titulo: 'Leído por' },
  { estado: 'delivered', titulo: 'Entregado a' },
  { estado: 'sent', titulo: 'Enviado' },
];

/** «Info» de un mensaje propio: quién lo leyó y a quién le llegó. */
export function DialogoInfo(props: { chatId: string; mensaje: MensajeEnPantalla; jwt: string; onCerrar: () => void }) {
  const [miembros, setMiembros] = useState<MiembroDeInfo[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void api<{ miembros: MiembroDeInfo[] }>(`/chats/${props.chatId}/messages/${props.mensaje.seq}/info`, { jwt: props.jwt }).then((respuesta) =>
      respuesta.ok ? setMiembros(respuesta.data.miembros) : setError(respuesta.message)
    );
  }, [props.chatId, props.mensaje.seq, props.jwt]);
  return (
    <Overlay title="Info del mensaje" onClose={props.onCerrar}>
      <p className="mb-4 line-clamp-3 rounded-lg bg-background px-3 py-2 text-sm">{props.mensaje.body ?? 'Archivo'}</p>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      {miembros === null && !error ? <div className="h-16 animate-pulse rounded-lg bg-background" /> : null}
      {GRUPOS.map(({ estado, titulo }) => {
        const deEste = (miembros ?? []).filter((uno) => uno.estado === estado);
        if (deEste.length === 0) return null;
        return (
          <section key={estado} className="mb-4">
            <h3 className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
              {estado === 'read' ? <CheckCheck size={14} className="text-primary" /> : estado === 'delivered' ? <CheckCheck size={14} /> : estado === 'sent' ? <Check size={14} /> : <Clock size={14} />}
              {titulo}
            </h3>
            {deEste.map((uno) => (
              <p key={uno.id} className="py-1 text-sm">{uno.name ?? uno.phone ?? 'Alguien'}</p>
            ))}
          </section>
        );
      })}
    </Overlay>
  );
}
