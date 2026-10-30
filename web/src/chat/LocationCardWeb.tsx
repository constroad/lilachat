import { useEffect, useState } from 'react';
import { ExternalLink, Radio, WifiOff } from 'lucide-react';
import { LIVE_KEEPALIVE_MS, accuracyLabel, liveCaption, liveStaleCaption, liveState, locationMapLink, type LiveLocation } from '@lilachat/shared';
import { api } from '../api';
import { LiveMapDialog } from './LiveMapDialog';
import { TileMapWeb } from './TileMapWeb';

const MAP = { width: 260, height: 140 };

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * «Now» while a live location lasts: once a keep-alive, so «Sin señal desde»
 * shows when the points stop (pending 12) and «Ya no comparte» when it ends.
 */
function useNowUntil(liveUntil: string | undefined): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!liveUntil || new Date(liveUntil).getTime() <= Date.now()) return undefined;
    const timer = setInterval(() => setNow(new Date()), LIVE_KEEPALIVE_MS);
    return () => clearInterval(timer);
  }, [liveUntil]);
  return now;
}

type Props = { location: LiveLocation; mio: boolean; live?: { jwt: string; chatId: string; seq: number } };

/**
 * A location shared in the chat (pending 11, design `r152-ubicacion`): a
 * still map from the OpenStreetMap tiles with the pin in the middle, the
 * accuracy and «Abrir en el mapa». The web shows it; sending one is the
 * phone's (WhatsApp Web does not send locations either). A live one says
 * until when, and its author can stop it from here too; the phone then stops.
 */
export function LocationCardWeb({ location, mio, live }: Props) {
  const now = useNowUntil(location.endedAt ? undefined : location.liveUntil);
  const [stopping, setStopping] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const stale = liveStaleCaption(location, now, clock);
  const caption = liveCaption(location, now, clock);
  const isLive = liveState(location, now) === 'live';
  const stop = async () => {
    if (!live) return;
    setStopping(true);
    await api(`/chats/${live.chatId}/locations/${live.seq}/stop`, { method: 'POST', jwt: live.jwt });
    setStopping(false);
  };
  const link = locationMapLink(location);
  return (
    <div data-testid="tarjeta-ubicacion" className="mb-1 w-[260px]">
      {mapOpen ? <LiveMapDialog location={location} now={now} clock={clock} onClose={() => setMapOpen(false)} /> : null}
      {/* Pending 12: the map opens inside Lilachat; «Abrir en el mapa» still goes to the maps site. */}
      <button type="button" data-testid="btn-ver-mapa" aria-label="Ver la ubicación en el mapa" onClick={() => setMapOpen(true)} className="block overflow-hidden rounded-lg">
        <TileMapWeb location={location} width={MAP.width} height={MAP.height} />
      </button>
      <p className="mt-2 text-[14px] font-semibold">{caption ? 'Ubicación en tiempo real' : 'Ubicación'}</p>
      {caption ? (
        <p className="flex items-center gap-1 text-[12px] opacity-75">
          {isLive ? <Radio size={12} /> : null}
          <span data-testid="estado-tiempo-real">{caption}</span>
        </p>
      ) : null}
      {stale ? <p data-testid="sin-senal" className="flex items-center gap-1 text-[12px] font-medium text-error"><WifiOff size={12} /> {stale}</p> : null}
      {location.accuracy !== undefined ? <p className="text-[12px] opacity-75">{accuracyLabel(location.accuracy)}</p> : null}
      <a data-testid="btn-abrir-mapa" href={link} target="_blank" rel="noopener noreferrer" className={`mt-2 flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold ${mio ? 'border-white/30' : 'border-primary/25 bg-primary/[0.06] text-primary'}`}>
        Abrir en el mapa <ExternalLink size={14} />
      </a>
      {mio && live && isLive ? (
        <button type="button" data-testid="btn-dejar-de-compartir" disabled={stopping} onClick={() => void stop()} className="mt-1 h-9 w-full text-[13px] font-semibold disabled:opacity-50">
          Dejar de compartir
        </button>
      ) : null}
    </div>
  );
}
