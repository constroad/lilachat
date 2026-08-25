import { useState } from 'react';
import { Plus, Send, Smile } from 'lucide-react';

/**
 * La barra de escritura del diseño: «+» suelto a la izquierda, el campo con
 * borde al medio, el emoji a su derecha y el botón de enviar como cuadrado
 * redondeado de acento — no un círculo.
 *
 * Enter envía y Shift+Enter hace salto de línea, que es lo que espera cualquiera
 * que venga de WhatsApp Web o Telegram Web.
 */
export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    onSend(value);
  };

  return (
    <div className="border-t border-outline/15 bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Adjuntar"
          title="Adjuntar (próximamente)"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-on-surface-variant/50"
        >
          <Plus size={20} />
        </button>

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
