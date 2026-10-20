import { colorDeAutor, formatClock } from '@lilachat/shared';
import { useConversacion } from '../contextoDeLaConversacion';
import type { MensajeEnPantalla } from '../types';
import { EncuestaEnElChat } from './EncuestaEnElChat';
import { EventoEnElChat } from './EventoEnElChat';
import { RecordatorioEnElChat } from './RecordatorioEnElChat';

/** Las clases de color de autor, escritas enteras para que Tailwind las genere. */
const COLOR_DE_AUTOR = ['', 'text-autor-1', 'text-autor-2', 'text-autor-3', 'text-autor-4', 'text-autor-5', 'text-autor-6'];

/**
 * Una encuesta, un evento o un recordatorio publicados en el chat, en la web
 * (W3c, 20/10; diseño `w3c-web-tarjetas`): la tarjeta en vez de la burbuja,
 * con quién la publicó y la hora arriba. Antes la web mostraba solo su texto.
 */
export function TarjetaDelMensaje({ mensaje, mio, conAutor }: { mensaje: MensajeEnPantalla; mio: boolean; conAutor: boolean }) {
  const { nombres } = useConversacion();
  const ref = mensaje.ref!;
  return (
    <div data-testid={`tarjeta-${ref.tipo}-${mensaje.seq}`} className={`w-[380px] max-w-full rounded-xl border p-4 text-on-surface shadow-sm ${mio ? 'border-primary/25 bg-primary/5' : 'border-outline/15 bg-surface'}`}>
      <div className="mb-2 flex items-center gap-2 empty:hidden">
        {conAutor && !mio ? <p className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${COLOR_DE_AUTOR[colorDeAutor(mensaje.senderId)]}`}>{nombres.get(mensaje.senderId) ?? 'Alguien'}</p> : <span className="flex-1" />}
        <span className="text-[11px] text-on-surface-variant">{formatClock(mensaje.at)}{mio ? ' · Tú' : ''}</span>
      </div>
      {ref.tipo === 'encuesta' ? <EncuestaEnElChat id={ref.id} /> : ref.tipo === 'evento' ? <EventoEnElChat id={ref.id} /> : <RecordatorioEnElChat id={ref.id} />}
    </div>
  );
}
