import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { insertarEnTexto, type MencionEnMensaje } from '@lilachat/shared';
import type { MencionElegida } from '@lilachat/shared';
import { formKeyOf } from '@lilachat/shared';
import type { WinkId } from '@lilachat/shared';

/** Se baja recién al abrir el panel (W2): pesa, y la mayoría no lo abre. */
const EmojiStickerPanel = lazyChunk(() => import('./stickers/EmojiStickerPanel'));
import { SugerenciasDeMencion, type Mencionable } from './SugerenciasDeMencion';
import { useMencionesDelCampo } from './useMencionesDelCampo';
import { readDraft, saveDraft } from './chatDrafts';
import { VistaPreviaAlEscribir } from './VistaPreviaAlEscribir';
import { CornerUpLeft, Mic, Pencil, Plus, Send, Smile, X } from 'lucide-react';
import { BarraDeGrabacion } from './BarraDeGrabacion';
import { useGrabadoraDeVoz, type NotaDeVozGrabada } from './useGrabadoraDeVoz';
import type { StickerChat } from './stickers/EmojiStickerPanel';
import { AttachMenu } from './AttachMenu';
import { useDismiss } from '../ui/useDismiss';
import { subscribeComposerInserts } from './composerInsert';
import type { ChatCommands } from './commands/useChatCommands';
import { CommandPanel } from './commands/CommandPanel';
import { EphemeralAnswers } from './commands/EphemeralAnswers';
import { AppFormDialog } from './commands/AppFormDialog';
import { loadPerfil } from '../api';
import { lazyChunk } from '../ui/lazyChunk';
import { EmojiSuggestions } from './emojiShortcode/EmojiSuggestions';
import { useEmojiShortcode } from './emojiShortcode/useEmojiShortcode';

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

/**
 * One field per chat (José, 25/10): a new chat remounts it, so the text, the open
 * panels and the chosen mentions never travel; each chat's draft comes back instead.
 */
export function Composer(props: ComponentProps<typeof ComposerField>) {
  return <ComposerField key={props.chatId} {...props} />;
}

function ComposerField({
  chatId,
  onSend,
  onCreateEvent,
  onCreatePoll,
  onNudge,
  onWink,
  recipient,
  onCreateReminder,
  onCreateChecklist,
  onElegirArchivos,
  contexto,
  onCancelarContexto,
  mencionables,
  onOutsideMentions,
  avisoDeMencion,
  jwtParaEnlaces,
  onNotaDeVoz,
  onEscribiendo,
  stickers,
  commands,
}: {
  /** Whose draft the field holds and saves. */
  chatId: string;
  /** The «/» of a space's chat (§c-bis): the apps' commands and what they answered only to me. */
  commands?: ChatCommands;
  /** For the Stickers tab (20/10); without it (secret chat), emojis only. */
  stickers?: StickerChat;
  contexto?: ContextoDelComposer | null;
  onCancelarContexto?: () => void;
  /** En grupos (W2): a quién se puede @mencionar. */
  mencionables?: Mencionable[];
  /** Mentioned people who are not in the chat, once the message left: the screen offers to add them. */
  onOutsideMentions?: (people: MencionElegida[]) => void;
  /** The offer to add them, over the field. */
  avisoDeMencion?: ReactNode;
  /** Para la tarjeta del enlace al escribir; sin él (chat secreto), no se pide. */
  jwtParaEnlaces?: string;
  /** Con esto, el campo vacío ofrece el micrófono (W2). */
  onNotaDeVoz?: (nota: NotaDeVozGrabada) => void;
  /** Cada tecla: los demás ven «escribiendo». */
  onEscribiendo?: () => void;
  onSend: (text: string, menciones?: MencionEnMensaje[]) => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  /** The MSN nudge and winks (backlog 3): in a 1:1, or in a group whose admin allows them. */
  onNudge?: () => void;
  onWink?: (wink: WinkId) => void;
  /** Who the winks go to: «Una animación a pantalla completa para Ana». */
  recipient?: string;
  /** W3c: solo cuando se puede (en un grupo, sus admins; nunca en un secreto). */
  onCreateReminder?: () => void;
  onCreateChecklist?: () => void;
  /** Las fotos o archivos elegidos (o pegados). Quien recibe esto muestra la vista previa y sube. */
  onElegirArchivos: (files: File[]) => void;
}) {
  const [text, setText] = useState(() => readDraft(chatId));
  // Saved as it is typed, since a reload runs no cleanup. The text of a message being edited is not a draft.
  useEffect(() => {
    if (contexto?.tipo !== 'edicion') saveDraft(chatId, text);
  }, [chatId, text, contexto?.tipo]);
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
  const emojis = useEmojiShortcode();
  // Opening a chat on a computer leaves the cursor in the field (José 30/10); on a phone it would raise the keyboard.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) campoRef.current?.focus({ preventScroll: true });
  }, []);
  const voz = useGrabadoraDeVoz();
  const [conEmojis, setConEmojis] = useState(false);
  // A click on the messages or Escape closes it; typing in the field keeps it open, like WhatsApp Web (José, 21/10).
  const emojiPanel = useRef<HTMLDivElement>(null);
  useDismiss(conEmojis, emojiPanel, () => setConEmojis(false), { ignore: '[data-testid="btn-emojis"], [data-testid="input-mensaje"]' });
  /** Where the caret goes once the new text is on screen. A frame later (rAF) raced fast typing after a mention (E2E, 20/10). */
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    campoRef.current?.focus();
    campoRef.current?.setSelectionRange(caret, caret);
  }, [text]);
  /** El emoji va donde está el cursor (o reemplaza lo seleccionado), como en la app. */
  const ponerEmoji = (emoji: string) => {
    const campo = campoRef.current;
    const seleccion = campo ? { start: campo.selectionStart, end: campo.selectionEnd } : null;
    const resultado = insertarEnTexto(text, seleccion, emoji);
    pendingCaret.current = resultado.cursor;
    setText(resultado.texto);
  };
  // The birthday card's «Saludar» (pending 17) writes here.
  const insertRef = useRef(ponerEmoji);
  insertRef.current = ponerEmoji;
  useEffect(() => subscribeComposerInserts((inserted) => insertRef.current(inserted)), []);
  const terminarNota = async (cancelar: boolean) => {
    const nota = await voz.terminar(cancelar);
    if (nota) onNotaDeVoz?.(nota);
  };
  const conMicrofono = Boolean(onNotaDeVoz) && !text.trim() && contexto?.tipo !== 'edicion';
  const pickEmoji = (emoji: string) => {
    const done = emojis.pick(text, campoRef.current?.selectionStart ?? text.length, emoji);
    if (!done) return;
    pendingCaret.current = done.caret;
    setText(done.text);
  };
  const elegirMencion = (uno: Mencionable) => {
    const completado = menciones.elegir(text, uno);
    if (!completado) return;
    pendingCaret.current = completado.cursor;
    setText(completado.texto);
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

  const pickCommand = (command: string) => {
    const written = `/${command} `;
    pendingCaret.current = written.length;
    setText(written);
    commands?.onType(written);
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    const rangos = menciones.mencionesDe(value);
    const outside = menciones.outside(value);
    menciones.limpiar();
    const sendAsText = () => {
      onSend(value, rangos.length ? rangos : undefined);
      if (outside.length > 0) onOutsideMentions?.(outside);
    };
    if (!commands) return sendAsText();
    void commands.runIfCommand(value).then((outcome) => {
      if (outcome === 'not-command') sendAsText();
      else if (!outcome) setText(value);
    });
  };

  return (
    <div className="border-t border-outline/15 bg-surface px-4 py-3">
      {avisoDeMencion}
      {contexto ? <FranjaDeContexto contexto={contexto} onCancelar={cancelarContexto} /> : null}
      {commands ? <EphemeralAnswers answers={commands.answers} onDismiss={commands.dismiss} onShare={commands.share} onOpenForm={commands.appAnswers.showForm} chatId={commands.chatId} jwt={commands.jwt} /> : null}
      {commands?.appAnswers.openForm ? (
        <AppFormDialog
          key={formKeyOf(commands.appAnswers.openForm)}
          answer={commands.appAnswers.openForm}
          personName={loadPerfil()?.name}
          onSubmit={(values) => commands.appAnswers.submitForm(commands.appAnswers.openForm!, values)}
          onUpload={(file, stamp) => commands.appAnswers.uploadPhoto(commands.appAnswers.openForm!.commandId, file, stamp)}
          onClose={() => commands.appAnswers.dismiss(commands.appAnswers.openForm!.commandId)}
        />
      ) : null}
      {commands ? <CommandPanel groups={commands.suggestions} active={commands.activeCommand} onPick={pickCommand} /> : null}
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
        <div ref={emojiPanel} data-testid="panel-emojis" className="mb-2">
          <Suspense fallback={<div className="h-[360px] animate-pulse rounded-lg bg-background" />}>
            {/* Sending a sticker closes the panel, like WhatsApp (José, 21/10). */}
            <EmojiStickerPanel onPickEmoji={ponerEmoji} chat={stickers ? { ...stickers, onSent: () => { stickers.onSent?.(); setConEmojis(false); } } : undefined} winks={onWink ? { recipient: recipient ?? 'el chat', onNudge, onSend: (wink) => { onWink(wink); setConEmojis(false); } } : undefined} />
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
            <AttachMenu
              onClose={() => setMenuAbierto(false)}
              onPickFile={() => archivoRef.current?.click()}
              onCreateEvent={onCreateEvent}
              onCreatePoll={onCreatePoll}
              onCreateReminder={onCreateReminder}
              onCreateChecklist={onCreateChecklist}
            />
          ) : null}
        </div>

        <div className="relative min-w-0 flex-1">
        <SugerenciasDeMencion opciones={menciones.opciones} activa={menciones.activa} onElegir={elegirMencion} />
        <EmojiSuggestions options={emojis.options} active={emojis.active} onPick={pickEmoji} />
        <textarea
          ref={campoRef}
          data-testid="input-mensaje"
          rows={1}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value) onEscribiendo?.();
            commands?.onType(event.target.value);
            menciones.alCambiar(event.target.value, event.target.selectionStart ?? event.target.value.length);
            emojis.onChange(event.target.value, event.target.selectionStart ?? event.target.value.length);
          }}
          onPaste={(event) => {
            // Pegar una captura (W2): va a la vista previa, como WhatsApp Web.
            const pegados = [...event.clipboardData.files];
            if (pegados.length === 0) return;
            event.preventDefault();
            onElegirArchivos(pegados);
          }}
          onKeyDown={(event) => {
            if (commands?.onKey(event, pickCommand)) return;
            if (emojis.onKey(event, pickEmoji)) return;
            if (menciones.alTeclear(event, elegirMencion)) return;
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape' && contexto) cancelarContexto();
          }}
          placeholder={commands?.enabled ? "Escribe un mensaje o / para comandos" : "Escribe un mensaje..."}
          className="block min-h-[40px] max-h-32 w-full resize-none rounded-lg border border-outline/25 bg-background px-3 py-2.5 text-[length:var(--chat-font,14px)] leading-[var(--chat-line,20px)] outline-none placeholder:text-on-surface-variant focus:border-primary"
        />
        </div>

        <button
          type="button"
          data-testid="btn-emojis"
          aria-label={conEmojis ? 'Cerrar los emojis' : 'Emojis'}
          aria-expanded={conEmojis}
          onClick={() => setConEmojis((abierto) => !abierto)}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-background ${conEmojis ? 'text-primary' : 'text-on-surface-variant'}`}
        >
          {conEmojis ? <X size={20} /> : <Smile size={20} />}
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
