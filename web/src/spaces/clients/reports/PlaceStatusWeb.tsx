import { Check, Loader2, MapPinOff } from 'lucide-react';
import { placeLineOf, type PhotoPlaceReading } from '@lilachat/shared';

const TONE = { busy: 'text-on-surface-variant', ok: 'text-primary', warn: 'text-on-surface-variant', error: 'text-error' } as const;

/** The GPS of the open photo section (José 19/11): «Obteniendo ubicación…» with its spinner, ready, or why it failed. */
export function PlaceStatusWeb(props: { reading: PhotoPlaceReading | null }) {
  const line = placeLineOf(props.reading);
  if (!line) return null;
  const busy = line.tone === 'busy';
  const icon = busy ? <Loader2 data-testid="ubicacion-cargando" size={15} className="shrink-0 animate-spin" aria-hidden /> : line.tone === 'ok' ? <Check size={15} className="shrink-0" aria-hidden /> : <MapPinOff size={15} className="shrink-0" aria-hidden />;
  return (
    <p data-testid="ubicacion-estado" role={line.tone === 'error' ? 'alert' : 'status'} aria-busy={busy} className={`flex items-center gap-2 text-[13px] font-semibold ${TONE[line.tone]}`}>
      {icon}
      {line.text}
    </p>
  );
}
