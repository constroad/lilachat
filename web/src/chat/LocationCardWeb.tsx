import { useEffect, useState } from 'react';
import { ExternalLink, MapPin, Radio } from 'lucide-react';
import { accuracyLabel, liveCaption, liveState, locationMapLink, mapTilesFor, type LiveLocation } from '@lilachat/shared';
import { api } from '../api';

const MAP = { width: 260, height: 140 };
const PIN = 30;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** «Now», again when a live location runs out, so the card turns to «Ya no comparte» by itself. */
function useNowUntil(liveUntil: string | undefined): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const left = liveUntil ? new Date(liveUntil).getTime() - Date.now() : 0;
    if (!(left > 0)) return undefined;
    const timer = setTimeout(() => setNow(new Date()), left + 500);
    return () => clearTimeout(timer);
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
  const caption = liveCaption(location, now, clock);
  const isLive = liveState(location, now) === 'live';
  const stop = async () => {
    if (!live) return;
    setStopping(true);
    await api(`/chats/${live.chatId}/locations/${live.seq}/stop`, { method: 'POST', jwt: live.jwt });
    setStopping(false);
  };
  const map = mapTilesFor(location, MAP);
  const link = locationMapLink(location);
  const radius = Math.min(map.accuracyRadius, MAP.width);
  return (
    <div data-testid="tarjeta-ubicacion" className="mb-1 w-[260px]">
      <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Abrir la ubicación en el mapa" className="relative block overflow-hidden rounded-lg bg-background" style={MAP}>
        {map.tiles.map((tile) => (
          <img key={tile.url} src={tile.url} alt="" loading="lazy" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />
        ))}
        {radius > 6 ? <span className="absolute rounded-full border border-primary/60 bg-primary/15" style={{ left: map.pin.left - radius, top: map.pin.top - radius, width: radius * 2, height: radius * 2 }} /> : null}
        <span data-testid="pin-ubicacion" className="absolute text-primary" style={{ left: map.pin.left - PIN / 2, top: map.pin.top - PIN }}>
          <MapPin size={PIN} fill="currentColor" stroke="white" strokeWidth={1.5} />
        </span>
        <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
      </a>
      <p className="mt-2 text-[14px] font-semibold">{caption ? 'Ubicación en tiempo real' : 'Ubicación'}</p>
      {caption ? (
        <p className="flex items-center gap-1 text-[12px] opacity-75">
          {isLive ? <Radio size={12} /> : null}
          <span data-testid="estado-tiempo-real">{caption}</span>
        </p>
      ) : null}
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
