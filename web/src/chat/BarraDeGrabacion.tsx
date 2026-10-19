import { Send, Trash2 } from 'lucide-react';
import { duracionDeVoz } from '@lilachat/shared';

/** Mientras se graba: el punto rojo, el tiempo, descartar y enviar. Como WhatsApp Web. */
export function BarraDeGrabacion(props: { ms: number; onCancelar: () => void; onEnviar: () => void }) {
  return (
    <div data-testid="barra-grabacion" className="flex items-center gap-3">
      <button type="button" data-testid="btn-cancelar-grabacion" aria-label="Descartar la nota de voz" onClick={props.onCancelar} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-error hover:bg-error/5">
        <Trash2 size={20} />
      </button>
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-on-surface">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
        <span className="tabular-nums" aria-live="polite">{duracionDeVoz(props.ms)}</span>
        <span className="text-on-surface-variant">Grabando…</span>
      </span>
      <button type="button" data-testid="btn-enviar-grabacion" aria-label="Enviar la nota de voz" onClick={props.onEnviar} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-on-primary">
        <Send size={18} />
      </button>
    </div>
  );
}
