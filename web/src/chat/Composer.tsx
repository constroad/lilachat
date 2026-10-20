import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { insertarEnTexto, type MencionEnMensaje } from '@lilachat/shared';

/** Se baja recién al abrir el panel (W2): pesa, y la mayoría no lo abre. */
const EmojiStickerPanel = lazy(() => import('./stickers/EmojiStickerPanel'));
import { SugerenciasDeMencion, type Mencionable } from './SugerenciasDeMencion';
import { useMencionesDelCampo } from './useMencionesDelCampo';
import { VistaPreviaAlEscribir } from './VistaPreviaAlEscribir';
import { Bell, CalendarPlus, CornerUpLeft, ListPlus, Mic, Paperclip, Pencil, Plus, Send, Smile, X } from 'lucide-react';
import { BarraDeGrabacion } from './BarraDeGrabacion';
import { useGrabadoraDeVoz, type NotaDeVozGrabada } from './useGrabadoraDeVoz';
import type { StickerChat } from './stickers/EmojiStickerPanel';

/**
 * La barra de escritura del diseño: «+» suelto a la izquierda, el campo con
 * borde al medio, el emoji a su derecha y el botón de enviar como cuadrado
 * redondeado de acento — no un círculo.
 *
 * Enter envía y Shift+Enter hace salto de línea, que es lo que espera cualquiera
 * que venga de WhatsApp Web o Telegram Web.
 */
/** Responder o editar (W2): la franja de arriba del campo, como WhatsApp Web. */
export type ContextoDelComposer = { tipo: 'respuesta' | 'edicion'; titulo: string; texto: string; clave: string };

export function Composer({
  onSend,
  onCreateEvent,
  onCreatePoll,
  onCreateReminder,
  onElegirArchivos,
  contexto,
  onCancelarContexto,
  mencionables,
  jwtParaEnlaces,
  onNotaDeVoz,
  onEscribiendo,
  stickers,
}: {
  /** For the Stickers tab (20/10); without it (secret chat), emojis only. */
  stickers?: StickerChat;
  contexto?: ContextoDelComposer | null;
  onCancelarContexto?: () => void;
  /** En grupos (W2): a quién se puede @mencionar. */
  mencionables?: Mencionable[];
  /** Para la tarjeta del enlace al escribir; sin él (chat secreto), no se pide. */
  jwtParaEnlaces?: string;
  /** Con esto, el campo vacío ofrece el micrófono (W2). */
  onNotaDeVoz?: (nota: NotaDeVozGrabada) => void;
  /** Cada tecla: los demás ven «escribiendo». */
  onEscribiendo?: () => void;
  onSend: (text: string, menciones?: MencionEnMensaje[]) => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  /** W3c: solo cuando se puede (en un grupo, sus admins; nunca en un secreto). */
  onCreateReminder?: () => void;
  /** Las fotos o archivos elegidos (o pegados). Quien recibe esto muestra la vista previa y sube. */
  onElegirArchivos: (files: File[]) => void;
}) {
  const [text, setText] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  /**
   * El `<input type="file">` va oculto y lo dispara el menú.
   *
   * Es la única forma de que el botón se vea como el resto: un input de archivo
   * sin estilar es un control del navegador que no se puede alinear con nada.
   */
  const archivoRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const menciones = useMencionesDelCampo(mencionables);
  const voz = useGrabadoraDeVoz();
  const [conEmojis, setConEmojis] = useState(false);
  /** El emoji va donde está el cursor (o reemplaza lo seleccionado), como en la app. */
  const ponerEmoji = (emoji: string) => {
    const campo = campoRef.current;
    const seleccion = campo ? { start: campo.selectionStart, end: campo.selectionEnd } : null;
    const resultado = insertarEnTexto(text, seleccion, emoji);
    setText(resultado.texto);
    requestAnimationFrame(() => {
      campoRef.current?.focus();
      campoRef.current?.setSelectionRange(resultado.cursor, resultado.cursor);
    });
  };
  const terminarNota = async (cancelar: boolean) => {
    const nota = await voz.terminar(cancelar);
    if (nota) onNotaDeVoz?.(nota);
  };
  const conMicrofono = Boolean(onNotaDeVoz) && !text.trim() && contexto?.tipo !== 'edicion';
  const elegirMencion = (uno: Mencionable) => {
    const completado = menciones.elegir(text, uno);
    if (!completado) return;
    setText(completado.texto);
    requestAnimationFrame(() => campoRef.current?.setSelectionRange(completado.cursor, completado.cursor));
  };

  // Responder o editar enfoca el campo; editar además trae el texto a editar.
  useEffect(() => {
    if (!contexto) return;
    if (contexto.tipo === 'edicion') setText(contexto.texto);
    campoRef.current?.focus();
  }, [contexto?.clave, contexto?.tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelarContexto = () => {
    // Salir de editar vacía el campo: lo que había era el texto viejo.
    if (contexto?.tipo === 'edicion') setText('');
    onCancelarContexto?.();
  };

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

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    const rangos = menciones.mencionesDe(value);
    menciones.limpiar();
    onSend(value, rangos.length ? rangos : undefined);
  };

  return (
    <div className="border-t border-outline/15 bg-surface px-4 py-3">
      {contexto ? <FranjaDeContexto contexto={contexto} onCancelar={cancelarContexto} /> : null}
      {jwtParaEnlaces && contexto?.tipo !== 'edicion' ? <VistaPreviaAlEscribir texto={text} jwt={jwtParaEnlaces} /> : null}
      <input
        ref={archivoRef}
        type="file"
        multiple
        data-testid="input-archivo"
        className="hidden"
        onChange={(evento) => {
          const elegidos = [...(evento.target.files ?? [])];
          // Se limpia el valor: sin esto, elegir el MISMO archivo dos veces
          // seguidas no dispara `change` y parece que el botón dejó de andar.
          evento.target.value = '';
          if (elegidos.length) onElegirArchivos(elegidos);
        }}
      />

      {conEmojis ? (
        <div data-testid="panel-emojis" className="mb-2" onKeyDown={(evento) => evento.key === 'Escape' && setConEmojis(false)}>
          <Suspense fallback={<div className="h-[360px] animate-pulse rounded-lg bg-background" />}>
            <EmojiStickerPanel onPickEmoji={ponerEmoji} chat={stickers} />
          </Suspense>
        </div>
      ) : null}
      {voz.estado.fase === 'error' ? (
        <p role="alert" className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-error/5 px-3 py-2 text-[13px] text-error">
          {voz.estado.motivo}
          <button type="button" aria-label="Cerrar el aviso" onClick={voz.limpiarError} className="grid h-8 w-8 place-items-center rounded-full">
            <X size={14} />
          </button>
        </p>
      ) : null}
      {voz.estado.fase === 'grabando' ? (
        <BarraDeGrabacion ms={voz.estado.ms} onCancelar={() => void terminarNota(true)} onEnviar={() => void terminarNota(false)} />
      ) : (
      <div className="flex items-center gap-2">
        {/* El «+» de WhatsApp: desde adentro del chat se arma un evento o una
            encuesta para ESA conversación, sin volver a elegir a nadie. */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            data-testid="btn-mas"
            aria-label="Crear"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant hover:bg-background"
          >
            <Plus size={20} />
          </button>

          {menuAbierto ? (
            <div
              data-testid="menu-adjuntar"
              className="absolute bottom-12 left-0 z-20 w-52 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg"
            >
              <button
                type="button"
                data-testid="btn-archivo-chat"
                onClick={() => {
                  setMenuAbierto(false);
                  archivoRef.current?.click();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-background"
              >
                <Paperclip size={16} className="shrink-0 text-on-surface-variant" />
                Foto o archivo
              </button>
              <button
                type="button"
                data-testid="btn-evento-chat"
                onClick={() => {
                  setMenuAbierto(false);
                  onCreateEvent();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-background"
              >
                <CalendarPlus size={16} className="shrink-0 text-on-surface-variant" />
                Evento
              </button>
              <button
                type="button"
                data-testid="btn-encuesta-chat"
                onClick={() => {
                  setMenuAbierto(false);
                  onCreatePoll();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-background"
              >
                <ListPlus size={16} className="shrink-0 text-on-surface-variant" />
                Encuesta
              </button>
              {onCreateReminder ? (
                <button
                  type="button"
                  data-testid="btn-recordatorio-chat"
                  onClick={() => {
                    setMenuAbierto(false);
                    onCreateReminder();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-background"
                >
                  <Bell size={16} className="shrink-0 text-on-surface-variant" />
                  Recordatorio
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="relative min-w-0 flex-1">
        <SugerenciasDeMencion opciones={menciones.opciones} activa={menciones.activa} onElegir={elegirMencion} />
        <textarea
          ref={campoRef}
          data-testid="input-mensaje"
          rows={1}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value) onEscribiendo?.();
            menciones.alCambiar(event.target.value, event.target.selectionStart ?? event.target.value.length);
          }}
          onPaste={(event) => {
            // Pegar una captura (W2): va a la vista previa, como WhatsApp Web.
            const pegados = [...event.clipboardData.files];
            if (pegados.length === 0) return;
            event.preventDefault();
            onElegirArchivos(pegados);
          }}
          onKeyDown={(event) => {
            if (menciones.alTeclear(event, elegirMencion)) return;
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape' && contexto) cancelarContexto();
          }}
          placeholder="Escribe un mensaje..."
          className="block min-h-[40px] max-h-32 w-full resize-none rounded-lg border border-outline/25 bg-background px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-on-surface-variant focus:border-primary"
        />
        </div>

        <button
          type="button"
          data-testid="btn-emojis"
          aria-label="Emojis"
          aria-expanded={conEmojis}
          onClick={() => setConEmojis((abierto) => !abierto)}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-background ${conEmojis ? 'text-primary' : 'text-on-surface-variant'}`}
        >
          <Smile size={20} />
        </button>

        {conMicrofono ? (
          <button type="button" data-testid="btn-microfono" aria-label="Grabar una nota de voz" onClick={() => void voz.empezar()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-on-primary">
            <Mic size={18} />
          </button>
        ) : (
        <button
          type="button"
          data-testid="btn-enviar"
          aria-label={contexto?.tipo === 'edicion' ? 'Guardar' : 'Enviar'}
          onClick={submit}
          disabled={!text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-on-primary transition-opacity disabled:opacity-40"
        >
          <Send size={18} />
        </button>
        )}
      </div>
      )}
    </div>
  );
}

/** «Respondiendo a Ana» o «Editando», con el texto recortado y una X para salir. */
function FranjaDeContexto({ contexto, onCancelar }: { contexto: ContextoDelComposer; onCancelar: () => void }) {
  return (
    <div data-testid={`franja-${contexto.tipo}`} className="mb-2 flex items-center gap-3 rounded-lg border-l-4 border-primary bg-background px-3 py-2">
      {contexto.tipo === 'edicion' ? <Pencil size={16} className="shrink-0 text-primary" /> : <CornerUpLeft size={16} className="shrink-0 text-primary" />}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-primary">{contexto.titulo}</p>
        <p className="truncate text-[13px] text-on-surface-variant">{contexto.texto}</p>
      </div>
      <button type="button" data-testid="btn-cancelar-franja" aria-label="Cancelar" onClick={onCancelar} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface">
        <X size={18} />
      </button>
    </div>
  );
}
