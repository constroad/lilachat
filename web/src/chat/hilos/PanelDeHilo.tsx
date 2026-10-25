import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ClipboardCheck, SendHorizontal, Smile, X } from 'lucide-react';
import { formatClock } from '@lilachat/shared';
import type { MencionElegida, MencionEnMensaje } from '@lilachat/shared';
import { ConversacionContext, useConversacion, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { StickerChat } from '../stickers/EmojiStickerPanel';
import { Avatar } from '../../ui/Avatar';
import { BurbujaDeMensaje } from '../BurbujaDeMensaje';
import { TextoDelMensaje } from '../TextoDelMensaje';
import { CreateChecklistOverlay } from '../../agenda/CreateChecklistOverlay';
import type { ChatSummary, MensajeEnPantalla } from '../types';
import { SugerenciasDeMencion, type Mencionable } from '../SugerenciasDeMencion';
import { useMencionesDelCampo } from '../useMencionesDelCampo';

const EmojiStickerPanel = lazy(() => import('../stickers/EmojiStickerPanel'));

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
  photos?: ReadonlyMap<string, string>;
  onEnviar: (texto: string, enElChat: boolean, menciones?: MencionEnMensaje[]) => void;
  /** Who `@` offers in the reply field (José 25/10: tagging did not work in threads). */
  mencionables?: Mencionable[];
  /** Mentioned people who are not in the channel, once the reply left: the screen offers to add them. */
  onOutsideMentions?: (people: MencionElegida[]) => void;
  /** The offer to add them, over the field. */
  avisoDeMencion?: ReactNode;
  onReintentar: (clientKey: string) => void;
  onDescartar: (clientKey: string) => void;
  /** Edit an own reply here (José, 20/10: «in a thread I can't edit my message»). */
  onEdit: (seq: number, text: string) => Promise<{ ok: boolean; motivo?: string }>;
  /** Emojis and stickers in the thread (20/10); without it (a secret chat), emojis only. */
  stickers?: Omit<StickerChat, 'thread' | 'onSent'>;
  onCerrar: () => void;
}) {
  const clave = `${props.chat.id}:${props.raiz.seq}`;
  const [texto, setTexto] = useState(() => borradores.get(clave) ?? '');
  const [enElChat, setEnElChat] = useState(false);
  const [editing, setEditing] = useState<MensajeEnPantalla | null>(null);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState('');
  /** A checklist inside the thread (backlog 30): its card stays among the replies. */
  const [creatingChecklist, setCreatingChecklist] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const menciones = useMencionesDelCampo(props.mencionables);
  const chooseMention = (uno: Mencionable) => {
    const completado = menciones.elegir(texto, uno);
    if (!completado) return;
    setTexto(completado.texto);
    if (!editing) borradores.set(clave, completado.texto);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(completado.cursor, completado.cursor);
    });
  };
  // The bubbles here: «Editar» edits in THIS input, and they do not repeat «Respondió en un hilo».
  const parent = useConversacion();
  const threadContext = useMemo<ContextoDeLaConversacion>(
    () => ({
      ...parent,
      inThread: true,
      onAccion: (mensaje: MensajeEnPantalla, accion: Parameters<ContextoDeLaConversacion['onAccion']>[1]) => {
        if (accion !== 'editar') return parent.onAccion(mensaje, accion);
        setEditing(mensaje);
        setTexto(mensaje.body ?? '');
        setNotice('');
        input.current?.focus();
      },
    }),
    [parent]
  );
  useEffect(() => {
    menciones.limpiar();
    setTexto(borradores.get(clave) ?? '');
    setEnElChat(false);
    setEditing(null);
    setPicking(false);
  }, [clave]);
  // Braces on purpose: recent Chrome returns a Promise from scrollIntoView, and a returned value is taken as the cleanup.
  useEffect(() => {
    fin.current?.scrollIntoView?.({ block: 'end' });
  }, [props.respuestas.length]);
  const nombreDe = (id: string) => (id === props.yo ? 'Tú' : (props.nombres.get(id) ?? 'Alguien'));
  const cuantas = props.respuestas.filter((uno) => !uno.estado).length;

  const stopEditing = () => {
    setEditing(null);
    setTexto(borradores.get(clave) ?? '');
  };
  const saveEdit = async (original: MensajeEnPantalla) => {
    const limpio = texto.trim();
    if (!limpio || limpio === original.body) return stopEditing();
    const result = await props.onEdit(original.seq, limpio);
    if (!result.ok) return setNotice(result.motivo ?? 'No se pudo editar.');
    stopEditing();
  };

  const enviar = () => {
    if (editing) return void saveEdit(editing);
    const limpio = texto.trim();
    if (!limpio) return;
    const rangos = menciones.mencionesDe(limpio);
    const outside = menciones.outside(limpio);
    menciones.limpiar();
    props.onEnviar(limpio, enElChat, rangos.length ? rangos : undefined);
    if (outside.length > 0) props.onOutsideMentions?.(outside);
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
        {props.chat.encrypted ? null : (
          <button type="button" data-testid="btn-checklist-hilo" aria-label="Crear un checklist en el hilo" title="Checklist en el hilo" onClick={() => setCreatingChecklist(true)} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background">
            <ClipboardCheck size={19} />
          </button>
        )}
        <button type="button" data-testid="btn-cerrar-hilo" aria-label="Cerrar el hilo" onClick={props.onCerrar} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background">
          <X size={20} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div data-testid="raiz-del-hilo" className="rounded-xl border border-outline/15 bg-surface p-3">
          <div className="flex items-center gap-2">
            <Avatar name={nombreDe(props.raiz.senderId)} foto={props.photos?.get(props.raiz.senderId)} size={28} />
            <span className="text-sm font-semibold">{nombreDe(props.raiz.senderId)}</span>
            <span className="text-[12px] text-on-surface-variant">{formatClock(props.raiz.at)}</span>
          </div>
          {/* Con sus links y menciones, como en la app (20/10). */}
          <div className="mt-2 text-sm">
            {props.raiz.deletedAt ? 'Se eliminó este mensaje' : props.raiz.body ? <TextoDelMensaje clave={`raiz-${props.raiz.clientKey}`} texto={props.raiz.body} menciones={props.raiz.menciones} nombres={props.nombres} yo={props.yo} mio={false} /> : props.raiz.media ? 'Archivo' : ''}
          </div>
        </div>
        <div className="my-3 flex items-center gap-3 text-[12px] text-on-surface-variant">
          <span className="h-px flex-1 bg-outline/15" />
          {cuantas === 1 ? '1 respuesta' : `${cuantas} respuestas`}
          <span className="h-px flex-1 bg-outline/15" />
        </div>
        <ConversacionContext.Provider value={threadContext}>
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
              flat={threadContext.flat}
              onReintentar={props.onReintentar}
              onDescartar={props.onDescartar}
            />
          );
        })}
        </ConversacionContext.Provider>
        <div ref={fin} />
        {creatingChecklist ? <CreateChecklistOverlay jwt={parent.jwt} chatId={props.chat.id} threadOf={props.raiz.seq} onClose={() => setCreatingChecklist(false)} /> : null}
      </div>
      <footer className="relative border-t border-outline/15 bg-surface px-3 pb-3 pt-2">
        {props.avisoDeMencion}
        {picking ? (
          <div data-testid="selector-hilo" className="absolute bottom-full left-2 right-2 mb-2">
            <Suspense fallback={<div className="h-[360px] animate-pulse rounded-lg bg-background" />}>
              <EmojiStickerPanel
                onPickEmoji={(emoji) => {
                  setTexto((before) => before + emoji);
                  setPicking(false);
                  input.current?.focus();
                }}
                chat={props.stickers ? { ...props.stickers, thread: { hiloDe: props.raiz.seq, enElChat }, onSent: () => { setPicking(false); setEnElChat(false); } } : undefined}
              />
            </Suspense>
          </div>
        ) : null}
        {editing ? (
          <div data-testid="barra-edicion-hilo" className="mb-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-[13px] font-semibold text-primary">
            <span className="min-w-0 flex-1 truncate">Editando tu mensaje</span>
            <button type="button" data-testid="btn-cancelar-edicion-hilo" aria-label="Cancelar la edición" onClick={stopEditing} className="grid h-7 w-7 place-items-center rounded-full hover:bg-background"><X size={15} /></button>
          </div>
        ) : null}
        {notice ? <p role="alert" data-testid="aviso-hilo" className="mb-1 text-[12px] text-error">{notice}</p> : null}
        <div className="flex items-end gap-2">
          <button type="button" data-testid="btn-emojis-hilo" aria-label="Emojis y stickers" aria-expanded={picking} onClick={() => setPicking((before) => !before)} className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-on-surface-variant hover:bg-background">
            <Smile size={20} />
          </button>
          <div className="relative min-w-0 flex-1">
          <SugerenciasDeMencion opciones={editing ? [] : menciones.opciones} activa={menciones.activa} onElegir={chooseMention} />
          <textarea
            ref={input}
            data-testid="input-hilo"
            value={texto}
            rows={1}
            onChange={(evento) => {
              setTexto(evento.target.value);
              menciones.alCambiar(evento.target.value, evento.target.selectionStart ?? evento.target.value.length);
              // While editing, the draft of a new reply is kept as it was (it comes back after saving).
              if (!editing) borradores.set(clave, evento.target.value);
            }}
            onKeyDown={(evento) => {
              if (!editing && menciones.alTeclear(evento, chooseMention)) return;
              if (evento.key === 'Enter' && !evento.shiftKey) {
                evento.preventDefault();
                enviar();
              }
            }}
            placeholder="Responder en el hilo…"
            className="block max-h-32 min-h-[44px] w-full resize-none rounded-xl border border-outline/25 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          </div>
          <button type="button" data-testid="btn-enviar-hilo" aria-label={editing ? 'Guardar la edición' : 'Enviar al hilo'} onClick={enviar} className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-on-primary">
            {editing ? <Check size={18} /> : <SendHorizontal size={18} />}
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
