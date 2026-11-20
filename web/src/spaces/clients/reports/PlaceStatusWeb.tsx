import { Check, Loader2, MapPin, MapPinOff } from 'lucide-react';
import { placeLineOf, type PhotoPlaceReading } from '@lilachat/shared';

const TONE = { busy: 'text-on-surface', ok: 'text-primary', warn: 'text-on-surface-variant', error: 'text-error' } as const;
const CARD = { busy: 'border-outline/20 bg-background', ok: 'border-primary/25 bg-primary/5', warn: 'border-outline/20 bg-background', error: 'border-error/40 bg-error/5' } as const;

/**
 * The GPS of the open photo section (José 19/11): «Obteniendo ubicación…» with its spinner, ready, or why it
 * failed. A card over the fields, as design imp-01/02 draws it: the state, the pin and the line.
 */
export function PlaceStatusWeb(props: { reading: PhotoPlaceReading | null }) {
  const line = placeLineOf(props.reading);
  if (!line) return null;
  const busy = line.tone === 'busy';
  const icon = busy ? <Loader2 data-testid="ubicacion-cargando" size={18} className="shrink-0 animate-spin text-primary" aria-hidden /> : line.tone === 'ok' ? <Check size={18} className="shrink-0" aria-hidden /> : <MapPinOff size={18} className="shrink-0" aria-hidden />;
  return (
    <div data-testid="ubicacion-estado" role={line.tone === 'error' ? 'alert' : 'status'} aria-busy={busy} className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[14px] font-semibold ${CARD[line.tone]} ${TONE[line.tone]}`}>
      {icon}
      {line.tone === 'error' ? null : <MapPin size={16} className="shrink-0 text-primary" aria-hidden />}
      <span className="min-w-0">{line.text}</span>
    </div>
  );
}
