import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { duracionDeVoz } from '@lilachat/shared';

/** Las barras que se dibujan si el mensaje no trae onda (una nota vieja). */
const ONDA_PLANA = Array.from({ length: 40 }, () => 20);

/**
 * Una nota de voz en la burbuja (W2): reproducir/pausar, la onda que se va
 * pintando con el avance y la duración. La onda viene del mensaje (la arma
 * quien graba, en la app o en la web).
 */
export function NotaDeVoz(props: { url: string; durationMs?: number; onda?: number[]; mio: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [sonando, setSonando] = useState(false);
  const [avance, setAvance] = useState(0);
  useEffect(() => () => audio.current?.pause(), []);

  const alternar = () => {
    if (!audio.current) {
      const nuevo = new Audio(props.url);
      nuevo.ontimeupdate = () => setAvance(nuevo.duration ? nuevo.currentTime / nuevo.duration : 0);
      nuevo.onended = () => {
        setSonando(false);
        setAvance(0);
      };
      audio.current = nuevo;
    }
    if (sonando) audio.current.pause();
    else void audio.current.play().catch(() => setSonando(false));
    setSonando(!sonando);
  };

  const onda = props.onda?.length ? props.onda : ONDA_PLANA;
  return (
    <div data-testid="nota-de-voz" className="flex min-w-[220px] items-center gap-3 py-1">
      <button type="button" aria-label={sonando ? 'Pausar' : 'Reproducir'} onClick={alternar} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${props.mio ? 'bg-on-primary/20' : 'bg-primary/10 text-primary'}`}>
        {sonando ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="flex h-8 min-w-0 flex-1 items-center gap-[2px]" aria-hidden>
        {onda.map((nivel, indice) => (
          <span key={indice} className={`w-[3px] rounded-full ${indice / onda.length <= avance ? (props.mio ? 'bg-on-primary' : 'bg-primary') : props.mio ? 'bg-on-primary/40' : 'bg-outline/40'}`} style={{ height: `${Math.max(12, nivel)}%` }} />
        ))}
      </div>
      <span className="shrink-0 text-[11px] tabular-nums opacity-80">{duracionDeVoz(props.durationMs)}</span>
    </div>
  );
}
