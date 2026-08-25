import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ListPlus, Plus, Send, Smile } from 'lucide-react';

/**
 * La barra de escritura del diseño: «+» suelto a la izquierda, el campo con
 * borde al medio, el emoji a su derecha y el botón de enviar como cuadrado
 * redondeado de acento — no un círculo.
 *
 * Enter envía y Shift+Enter hace salto de línea, que es lo que espera cualquiera
 * que venga de WhatsApp Web o Telegram Web.
 */
export function Composer({
  onSend,
  onCreateEvent,
  onCreatePoll,
}: {
  onSend: (text: string) => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
}) {
  const [text, setText] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    onSend(value);
  };

  return (
    <div className="border-t border-outline/15 bg-surface px-4 py-3">
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
            </div>
          ) : null}
        </div>

        <textarea
          data-testid="input-mensaje"
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Escribe un mensaje..."
          className="min-h-[40px] max-h-32 min-w-0 flex-1 resize-none rounded-lg border border-outline/25 bg-background px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-on-surface-variant focus:border-primary"
        />

        <button
          type="button"
          aria-label="Emojis"
          title="Emojis (próximamente)"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-on-surface-variant/50"
        >
          <Smile size={20} />
        </button>

        <button
          type="button"
          data-testid="btn-enviar"
          aria-label="Enviar"
          onClick={submit}
          disabled={!text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-on-primary transition-opacity disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
