import { useEffect, useRef, useState } from 'react';
import { SendHorizontal, X } from 'lucide-react';
import { formatClock } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { BurbujaDeMensaje } from '../BurbujaDeMensaje';
import type { ChatSummary, MensajeEnPantalla } from '../types';

/** Lo escrito y no mandado en cada hilo, mientras la pestaña está abierta. */
const borradores = new Map<string, string>();

/**
 * El hilo a la derecha (E3, 20/10; diseño `e3-web-hilo`), como el panel de
 * «Info.»: tercera columna desde 1024 px y pantalla completa debajo. La raíz
 * arriba, las respuestas con las mismas burbujas del chat (menú, checks,
 * reintentar) y un campo para responder con «También enviar al chat».
 */
export function PanelDeHilo(props: {
  chat: ChatSummary;
  raiz: MensajeEnPantalla;
  respuestas: MensajeEnPantalla[];
  yo: string;
  nombres: ReadonlyMap<string, string>;
  onEnviar: (texto: string, enElChat: boolean) => void;
  onReintentar: (clientKey: string) => void;
  onDescartar: (clientKey: string) => void;
  onCerrar: () => void;
}) {
  const clave = `${props.chat.id}:${props.raiz.seq}`;
  const [texto, setTexto] = useState(() => borradores.get(clave) ?? '');
  const [enElChat, setEnElChat] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTexto(borradores.get(clave) ?? '');
    setEnElChat(false);
  }, [clave]);
  useEffect(() => fin.current?.scrollIntoView?.({ block: 'end' }), [props.respuestas.length]);
  const nombreDe = (id: string) => (id === props.yo ? 'Tú' : (props.nombres.get(id) ?? 'Alguien'));
  const cuantas = props.respuestas.filter((uno) => !uno.estado).length;

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    props.onEnviar(limpio, enElChat);
    setTexto('');
    // Como en Slack: «También enviar al chat» vale para una respuesta, no para las que siguen.
    setEnElChat(false);
    borradores.delete(clave);
  };

  return (
    <aside data-testid="panel-hilo" className="fixed inset-0 z-30 flex flex-col bg-background lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:border-l lg:border-outline/15">
      <header className="flex items-center gap-3 border-b border-outline/15 bg-surface px-3 py-3">
        <div className="min-w-0 flex-1 pl-1">
          <h2 className="text-base font-semibold">Hilo</h2>
          <p className="truncate text-[12px] text-on-surface-variant">{props.chat.name ?? props.chat.phone ?? 'Conversación'}</p>
        </div>
        <button type="button" data-testid="btn-cerrar-hilo" aria-label="Cerrar el hilo" onClick={props.onCerrar} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <X size={20} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div data-testid="raiz-del-hilo" className="rounded-xl border border-outline/15 bg-surface p-3">
          <div className="flex items-center gap-2">
            <Avatar name={nombreDe(props.raiz.senderId)} size={28} />
            <span className="text-sm font-semibold">{nombreDe(props.raiz.senderId)}</span>
            <span className="text-[12px] text-on-surface-variant">{formatClock(props.raiz.at)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{props.raiz.deletedAt ? 'Se eliminó este mensaje' : (props.raiz.body ?? (props.raiz.media ? 'Archivo' : ''))}</p>
        </div>
        <div className="my-3 flex items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="h-px flex-1 bg-outline/15" />
          {cuantas === 1 ? '1 respuesta' : `${cuantas} respuestas`}
          <span className="h-px flex-1 bg-outline/15" />
        </div>
        {props.respuestas.map((mensaje, indice) => {
          const anterior = props.respuestas[indice - 1];
          const mio = mensaje.senderId === props.yo;
          return (
            <BurbujaDeMensaje
              key={mensaje.clientKey}
              mensaje={mensaje}
              mio={mio}
              agrupado={anterior?.senderId === mensaje.senderId}
              ultimoDelGrupo
              conAutor={props.chat.kind === 'group' && !mio && anterior?.senderId !== mensaje.senderId}
              chat={props.chat}
              onReintentar={props.onReintentar}
              onDescartar={props.onDescartar}
            />
          );
        })}
        <div ref={fin} />
      </div>
      <footer className="border-t border-outline/15 bg-surface px-3 pb-3 pt-2">
        <div className="flex items-end gap-2">
          <textarea
            data-testid="input-hilo"
            value={texto}
            rows={1}
            onChange={(evento) => {
              setTexto(evento.target.value);
              borradores.set(clave, evento.target.value);
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter' && !evento.shiftKey) {
                evento.preventDefault();
                enviar();
              }
            }}
            placeholder="Responder en el hilo…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-outline/25 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button type="button" data-testid="btn-enviar-hilo" aria-label="Enviar al hilo" onClick={enviar} className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-on-primary">
            <SendHorizontal size={18} />
          </button>
        </div>
        <label className="mt-2 flex min-h-[32px] cursor-pointer items-center gap-2 text-[13px] text-on-surface-variant">
          <input data-testid="casilla-tambien-al-chat" type="checkbox" checked={enElChat} onChange={(evento) => setEnElChat(evento.target.checked)} className="h-4 w-4 accent-primary" />
          También enviar al chat
        </label>
      </footer>
    </aside>
  );
}
