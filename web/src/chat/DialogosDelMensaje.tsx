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
