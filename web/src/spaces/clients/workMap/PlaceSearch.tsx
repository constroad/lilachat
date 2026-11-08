import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { findPlace, type PlaceAsk, type PlaceResult, type WorkMapPoint } from '@lilachat/shared';

/**
 * «Busca un lugar o pega el enlace» over the street editor (José 08/11, the same as Portal): a
 * place name, «lat,lng» or the Google Maps link the client sends. A pick takes the map there.
 */
export function PlaceSearch(props: { ask?: PlaceAsk; near?: WorkMapPoint; onPick: (point: WorkMapPoint) => void }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = (place: PlaceResult) => { setResults([]); props.onPick({ lat: place.lat, lng: place.lng }); };
  const search = async () => {
    setBusy(true);
    setError(null);
    const answer = await findPlace(text, props.ask ?? (async () => ({ ok: false, message: 'Escribe las coordenadas o pega el enlace.' })), props.near);
    setBusy(false);
    if (!answer.ok) return setError(answer.message);
    if (answer.results.length === 1) return pick(answer.results[0]!);
    setResults(answer.results);
  };
  return (
    <form data-testid="editor-buscar" role="search" onSubmit={(event) => { event.preventDefault(); void search(); }} className="relative mt-2">
      <div className="flex gap-2">
        <input data-testid="editor-buscar-lugar" value={text} onChange={(event) => setText(event.target.value)} placeholder="Busca un lugar o pega el enlace de Google Maps" aria-label="Buscar lugar" className="h-10 min-w-0 flex-1 rounded-xl bg-surface px-3 text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant" />
        <button type="submit" data-testid="editor-buscar-ir" disabled={busy || !text.trim()} aria-label="Buscar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-primary disabled:opacity-60"><Search size={18} /></button>
      </div>
      {error ? <p data-testid="editor-buscar-error" role="alert" className="mt-1 text-[12px] font-semibold">{error}</p> : null}
      {results.length ? (
        <ul className="absolute inset-x-0 top-11 z-20 overflow-hidden rounded-xl border border-outline/15 bg-surface text-on-surface shadow-lg">
          {results.map((place, index) => (
            <li key={`${place.lat},${place.lng}`}>
              <button type="button" data-testid={`editor-lugar-${index}`} onClick={() => pick(place)} className="flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] hover:bg-background"><MapPin size={14} className="mt-0.5 shrink-0 text-primary" /><span className="line-clamp-2">{place.name}</span></button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
