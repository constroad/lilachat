import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { duracionDeVoz, nextPlaybackRate, scrubFraction } from '@lilachat/shared';

/** Las barras que se dibujan si el mensaje no trae onda (una nota vieja). */
const ONDA_PLANA = Array.from({ length: 40 }, () => 20);

/** One note plays at a time: the one that starts pauses the one that was playing. */
let playing: HTMLAudioElement | null = null;

/**
 * A voice note in the bubble, like WhatsApp (W2; backlog 34, José 21/10: it
 * felt clumsy and could not be moved forward or back): one tap plays, the
 * waveform fills as it goes and can be clicked or dragged to jump (also
 * before playing), the time runs while it plays, the speed goes 1× · 1,5× ·
 * 2×, and only one note sounds at a time.
 */
export function NotaDeVoz(props: { url: string; durationMs?: number; onda?: number[]; mio: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [sounding, setSounding] = useState(false);
  const [share, setShare] = useState(0);
  const [rate, setRate] = useState(1);
  const [dragShare, setDragShare] = useState<number | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  /** The audio is created on the first use; its own events say what it is doing. */
  const ensureAudio = () => {
    if (audio.current) return audio.current;
    const created = new Audio(props.url);
    created.playbackRate = rate;
    created.addEventListener('timeupdate', () => setShare(created.duration ? created.currentTime / created.duration : 0));
    created.addEventListener('play', () => setSounding(true));
    created.addEventListener('pause', () => setSounding(false));
    created.addEventListener('ended', () => {
      setSounding(false);
      setShare(0);
    });
    audio.current = created;
    return created;
  };
  // Fetched ahead while it is on screen (José, 21/10: «carga y luego reproduce»): a tap plays at once.
  // The message list is virtualized, so only the notes in sight download.
  useEffect(() => {
    ensureAudio().preload = 'auto';
    // Once per note: the audio lives in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const durationS = () => (audio.current?.duration && Number.isFinite(audio.current.duration) ? audio.current.duration : (props.durationMs ?? 0) / 1000);

  const play = () => {
    const current = ensureAudio();
    if (playing && playing !== current) playing.pause();
    playing = current;
    void current.play().catch(() => setSounding(false));
  };
  const toggle = () => (sounding ? audio.current?.pause() : play());

  const shareAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = bar.current?.getBoundingClientRect();
    return box ? scrubFraction(event.clientX - box.left, box.width) : 0;
  };
  const seek = (target: number) => {
    const current = ensureAudio();
    current.currentTime = target * durationS();
    setShare(target);
  };

  const shown = dragShare ?? share;
  const ms = dragShare !== null || sounding || share > 0 ? shown * durationS() * 1000 : props.durationMs;
  const onda = props.onda?.length ? props.onda : ONDA_PLANA;
  return (
    <div data-testid="nota-de-voz" className="flex min-w-[240px] items-center gap-3 py-1">
      <button type="button" aria-label={sounding ? 'Pausar' : 'Reproducir'} onClick={toggle} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${props.mio ? 'bg-on-primary/20' : 'bg-primary/10 text-primary'}`}>
        {sounding ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          ref={bar}
          data-testid="barra-voz"
          role="slider"
          aria-label="Ir a un punto de la nota"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(shown * 100)}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setDragShare(shareAt(event));
          }}
          onPointerMove={(event) => dragShare !== null && setDragShare(shareAt(event))}
          onPointerUp={(event) => {
            seek(shareAt(event));
            setDragShare(null);
          }}
          onPointerCancel={() => setDragShare(null)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') seek(Math.min(1, shown + 0.05));
            if (event.key === 'ArrowLeft') seek(Math.max(0, shown - 0.05));
          }}
          className="flex h-8 cursor-pointer touch-none items-center gap-[2px]"
        >
          {onda.map((nivel, indice) => (
            <span key={indice} className={`w-[3px] rounded-full ${indice / onda.length <= shown ? (props.mio ? 'bg-on-primary' : 'bg-primary') : props.mio ? 'bg-on-primary/40' : 'bg-outline/40'}`} style={{ height: `${Math.max(12, nivel)}%` }} />
          ))}
        </div>
        <span className="text-[11px] tabular-nums opacity-80">{duracionDeVoz(ms)}</span>
      </div>
      <button
        type="button"
        data-testid="velocidad-voz"
        aria-label={`Velocidad ${rate}×`}
        onClick={() => {
          const next = nextPlaybackRate(rate);
          setRate(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
        className={`shrink-0 rounded-full px-2 py-1 text-[12px] font-bold tabular-nums ${props.mio ? 'bg-on-primary/20' : 'bg-primary/10 text-primary'}`}
      >
        {`${String(rate).replace('.', ',')}×`}
      </button>
    </div>
  );
}
