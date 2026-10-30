import { useState } from 'react';
import { Minus, Navigation, Plus, Radio, WifiOff } from 'lucide-react';
import { LIVE_MAP_DEFAULT_ZOOM, accuracyLabel, clampMapZoom, liveCaption, liveStaleCaption, liveState, locationMapLink, type LiveLocation } from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';
import { TileMapWeb } from './TileMapWeb';

const MAP = { width: 640, height: 420 };

/**
 * The map inside Lilachat (pending 12): bigger, with zoom, following the point
 * while it is live (the card re-renders with each position). «Cómo llegar»
 * opens the maps site.
 */
export function LiveMapDialog(props: { location: LiveLocation; now: Date; clock: (iso: string) => string; onClose: () => void }) {
  const [zoom, setZoom] = useState(LIVE_MAP_DEFAULT_ZOOM);
  const caption = liveCaption(props.location, props.now, props.clock);
  const stale = liveStaleCaption(props.location, props.now, props.clock);
  const live = liveState(props.location, props.now) === 'live';
  const zoomButton = (testId: string, next: number, label: string, Icon: typeof Plus) => (
    <button type="button" data-testid={testId} aria-label={label} onClick={() => setZoom(clampMapZoom(next))} className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow">
      <Icon size={18} />
    </button>
  );
  return (
    <Overlay title={caption ? 'Ubicación en tiempo real' : 'Ubicación'} onClose={props.onClose} wide>
      <div data-testid="mapa-en-vivo">
        {caption ? <p className="mb-2 text-sm text-on-surface-variant">{caption}</p> : null}
        <div className="relative max-w-full overflow-hidden rounded-xl">
          <TileMapWeb location={props.location} width={MAP.width} height={MAP.height} zoom={zoom} />
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            {zoomButton('btn-acercar-mapa', zoom + 1, 'Acercar', Plus)}
            {zoomButton('btn-alejar-mapa', zoom - 1, 'Alejar', Minus)}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {stale ? <span data-testid="sin-senal" className="flex items-center gap-1.5 text-error"><WifiOff size={14} /> {stale}</span> : live ? <span className="flex items-center gap-1.5 text-on-surface-variant"><Radio size={14} /> Se mueve con su teléfono</span> : null}
          {props.location.accuracy !== undefined ? <span className="text-on-surface-variant">{accuracyLabel(props.location.accuracy)}</span> : null}
          <a data-testid="btn-como-llegar" href={locationMapLink(props.location)} target="_blank" rel="noopener noreferrer" className="ml-auto flex min-h-[40px] items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary">
            <Navigation size={16} /> Cómo llegar
          </a>
        </div>
      </div>
    </Overlay>
  );
}
