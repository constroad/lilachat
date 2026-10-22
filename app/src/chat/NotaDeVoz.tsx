import { useEffect, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { firstPlay, nextPlaybackRate } from '@lilachat/shared';
import { soltarElAudio, tomarElAudio } from './notaDeVozMotor';
import { reportarError } from '../ui/reportarError';
import { playbackAudioMode } from './audioMode';
import { useVoiceNoteSource } from './voiceNoteCache';
import { VoiceNoteView as VistaDeNota } from './VoiceNoteView';

/** Longer than this, Android stops background audio after ~3 min unless it shows lock-screen controls. */
const LOCK_SCREEN_FROM_S = 150;

/** Plays with the screen locked (20/10); a long audio also gets lock-screen controls so Android does not cut it. */
function playInBackground(player: AudioPlayer, durationS: number): void {
  void setAudioModeAsync(playbackAudioMode()).catch((error) => reportarError('nota.audioMode', error));
  if (durationS >= LOCK_SCREEN_FROM_S) player.setActiveForLockScreen(true, { title: 'Nota de voz' });
  player.play();
}

type PropsDeNota = {
  id: string;
  url: string;
  durationMs?: number;
  onda?: number[];
  /** En la propia (violeta sólido, FL13) todo va en el color del texto. */
  mia?: boolean;
  /** Who recorded it: their photo with the microphone, like WhatsApp (José, 21/10). */
  author?: { name: string; photo?: string };
};

/**
 * La nota de voz, con su play, su tiempo y —como WhatsApp (FL9b)— la velocidad
 * (1× / 1,5× / 2×), una sola sonando a la vez, y tocar la barra para saltar.
 *
 * **El reproductor nace al primer toque** (FL12, §49 #10). `useAudioPlayer`
 * crea un reproductor nativo y empieza a bajar el audio al montarse: un chat
 * con diez notas visibles eran diez reproductores y diez descargas peleando
 * con las fotos. Hasta que se toca, es solo la onda y la duración guardadas.
 *
 * **The file IS downloaded ahead** (José, 21/10: it loaded and then played,
 * WhatsApp plays at once): a note in sight is fetched to the phone in the
 * background (`voiceNoteCache.ts`), and play reads it from the disk.
 *
 * **No arranca solo.** Un audio que empieza a sonar al aparecer en pantalla es
 * lo peor que puede hacer una app de mensajería: suena en la mesa, en la
 * reunión, o encima de otro audio.
 */
export function NotaDeVoz(props: PropsDeNota) {
  /** What plays, fixed at the touch: a download finishing mid-play must not restart it. */
  const [activa, setActiva] = useState<string | null>(null);
  const [velocidad, setVelocidad] = useState(1);
  /** Touching the bar before the first play starts there (backlog 34). */
  const [startShare, setStartShare] = useState<number | null>(null);
  const source = useVoiceNoteSource(props.url) ?? props.url;
  if (activa) return <ActiveVoiceNote {...props} url={activa} velocidadInicial={velocidad} startShare={startShare} />;
  return (
    <VistaDeNota
      mia={props.mia}
      onda={props.onda}
      author={props.author}
      sonando={false}
      ms={props.durationMs ?? 0}
      avance={0}
      velocidad={velocidad}
      onPlay={() => setActiva(source)}
      onVelocidad={() => setVelocidad(nextPlaybackRate(velocidad))}
      durationS={(props.durationMs ?? 0) / 1000}
      onSeek={(share) => {
        setStartShare(share);
        setActiva(source);
      }}
    />
  );
}

/** Ya tocada: el reproductor vive y arranca solo, porque es la respuesta al toque. */
function ActiveVoiceNote({ id, url, durationMs, onda, mia, author, velocidadInicial, startShare }: PropsDeNota & { velocidadInicial: number; startShare: number | null }) {
  const player = useAudioPlayer(url);
  const estado = useAudioPlayerStatus(player);
  const [velocidad, setVelocidad] = useState(velocidadInicial);
  const arrancada = useRef(false);

  useEffect(() => () => soltarElAudio(id), [id]);
  // A finished long audio takes its lock-screen controls away.
  useEffect(() => {
    if (estado.didJustFinish && estado.duration >= LOCK_SCREEN_FROM_S) player.clearLockScreenControls();
  }, [estado.didJustFinish, estado.duration, player]);

  const sonando = estado.playing;
  // En reposo se muestra la duración REAL que se grabó (guardada al subir): el
  // `m4a` remoto reporta mal su duración hasta cargar entero, y ahí salía «0:25»
  // para una nota de 4 segundos. Al reproducir se muestra lo que va corriendo.
  const enReposo = durationMs ?? estado.duration * 1000;
  const ms = sonando || estado.currentTime > 0 ? estado.currentTime * 1000 : enReposo;
  const duracion = estado.duration > 0 ? estado.duration : (durationMs ?? 0) / 1000;
  /** 0→1: cuánto va sonando. */
  const avance = duracion > 0 ? Math.min(1, estado.currentTime / duracion) : 0;

  const reproducir = () => {
    if (sonando) return player.pause();
    // Terminada: vuelve al principio. Sin esto, el segundo toque no hace nada
    // y parece que el audio se rompió.
    if (estado.didJustFinish || estado.currentTime >= estado.duration) player.seekTo(0);
    tomarElAudio(id, () => player.pause());
    player.setPlaybackRate(velocidad);
    playInBackground(player, duracion);
  };

  // The tap that activated it asked to play: once the audio is loaded (Android ignores an earlier play), from where it was touched.
  useEffect(() => {
    const decision = firstPlay({ loaded: estado.isLoaded, started: arrancada.current, startShare, duration: duracion });
    if (!decision.play) return;
    arrancada.current = true;
    if (decision.seekTo > 0) void player.seekTo(decision.seekTo);
    tomarElAudio(id, () => player.pause());
    player.setPlaybackRate(velocidad);
    playInBackground(player, duracion);
  }, [estado.isLoaded, id, player, velocidad, duracion, startShare]);

  return (
    <VistaDeNota
      mia={mia}
      onda={onda}
      author={author}
      sonando={sonando}
      ms={ms}
      avance={avance}
      velocidad={velocidad}
      onPlay={reproducir}
      onVelocidad={() => {
        const next = nextPlaybackRate(velocidad);
        setVelocidad(next);
        player.setPlaybackRate(next);
      }}
      loading={!estado.isLoaded}
      durationS={duracion}
      onSeek={(share) => void player.seekTo(share * duracion)}
    />
  );
}
