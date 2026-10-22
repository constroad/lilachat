import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { GIF_SUGGESTIONS, type GifResult } from '@lilachat/shared';
import { newGifKey, searchGifs, sendGif } from './gifsApi';
import { addGifInFlight, removeGifInFlight } from './gifsInFlight';

/** After the server answered, the pending bubble waits this much for the real one before going. */
const HANDOVER_MS = 5_000;

const SEARCH_DEBOUNCE_MS = 400;
const PAGE = 24;
/** «Tendencias» is the empty search: GIPHY's trending. */
const CHIPS = [{ label: 'Tendencias', q: '' }, ...GIF_SUGGESTIONS.map((label) => ({ label, q: label }))];

function useGifSearch(jwt: string, q: string) {
  const [gifs, setGifs] = useState<GifResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = useRef(false);
  const load = useCallback(async (offset: number) => {
    if (loading.current) return;
    loading.current = true;
    const result = await searchGifs(jwt, q, offset);
    loading.current = false;
    if (!result.ok) return setFailed(true);
    setFailed(false);
    setGifs((before) => (offset === 0 ? result.data.gifs : [...(before ?? []), ...result.data.gifs]));
  }, [jwt, q]);
  useEffect(() => {
    setGifs(null);
    const timer = window.setTimeout(() => void load(0), q ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [load, q]);
  return { gifs, failed, more: () => gifs && gifs.length % PAGE === 0 && void load(gifs.length) };
}

/**
 * The «GIF» tab of the panel on the web, like the app's (backlog 37; design
 * `g-01-panel-gif-giphy`): search, suggestion chips, a grid of moving
 * previews and «Powered by GIPHY». A click sends it.
 */
export function GifPanel(props: { jwt: string; chatId: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { gifs, failed, more } = useGifSearch(props.jwt, text.trim());
  const send = async (gif: GifResult) => {
    setError(null);
    const clientKey = newGifKey();
    // In the chat at once, as GIPHY's preview «sending» (22/10): the server takes a few seconds to store it.
    addGifInFlight(props.chatId, clientKey, gif);
    const result = await sendGif(props.jwt, props.chatId, gif.id, clientKey);
    if (!result.ok) {
      removeGifInFlight(clientKey);
      return setError(result.message);
    }
    // The conversation already drops it when the real message arrives; this only tidies up.
    window.setTimeout(() => removeGifInFlight(clientKey), HANDOVER_MS);
  };
  return (
    <div data-testid="panel-gif" className="flex h-full min-h-0 flex-col">
      <label className="mx-3 mt-2 flex h-9 items-center gap-2 rounded-full border border-outline/20 bg-surface px-3">
        <Search size={15} className="text-on-surface-variant" />
        <input data-testid="buscar-gif" value={text} onChange={(event) => setText(event.target.value)} placeholder="Buscar GIF" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="flex gap-2 overflow-x-auto px-3 py-2">
        {CHIPS.map((chip) => (
          <button key={chip.label} type="button" data-testid={`chip-gif-${chip.label}`} onClick={() => setText(chip.q)} className={`shrink-0 rounded-full border px-3 py-1 text-[13px] ${text.trim() === chip.q ? 'border-primary/40 bg-primary/10 font-semibold text-primary' : 'border-outline/20 bg-surface'}`}>
            {chip.label}
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="px-4 pb-1 text-[13px] text-error">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-2" onScroll={(event) => event.currentTarget.scrollTop + event.currentTarget.clientHeight >= event.currentTarget.scrollHeight - 80 && more()}>
        {gifs === null ? (
          failed ? <p className="p-4 text-center text-[13px] text-on-surface-variant">GIPHY no respondió. Inténtalo de nuevo.</p> : <div className="m-2 h-24 animate-pulse rounded-lg bg-background" />
        ) : gifs.length === 0 ? (
          <p className="p-4 text-center text-[13px] text-on-surface-variant">No encontramos GIF con eso.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 pb-2">
            {gifs.map((gif) => (
              <button key={gif.id} type="button" data-testid={`gif-${gif.id}`} title={gif.title || 'GIF'} onClick={() => void send(gif)} className="overflow-hidden rounded-lg bg-background">
                <img src={gif.previewUrl} alt={gif.title || 'GIF'} loading="lazy" className="h-28 w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Powered by GIPHY</p>
    </div>
  );
}
