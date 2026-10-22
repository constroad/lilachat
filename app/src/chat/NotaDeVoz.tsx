import { useState } from 'react';
import { nextPlaybackRate } from '@lilachat/shared';
import { useVoiceNoteSource } from './voiceNoteCache';
import { VoiceNoteView as VistaDeNota } from './VoiceNoteView';
import { playVoiceNote, seekVoiceNote, setVoiceNoteRate, toggleVoiceNote, useNowPlaying } from './voicePlayer';

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
  const [velocidad, setVelocidad] = useState(1);
  const source = useVoiceNoteSource(props.url) ?? props.url;
  const now = useNowPlaying();
  const durationS = (props.durationMs ?? 0) / 1000;
  // The player is the session's (`voicePlayer.ts`, backlog 34): leaving the chat does not cut it.
  const start = (startShare: number | null) => playVoiceNote({ id: props.id, url: source, authorName: props.author?.name ?? 'Nota de voz', authorPhoto: props.author?.photo, durationS, rate: velocidad, startShare });
  if (now?.id === props.id) {
    // En reposo se muestra la duración REAL que se grabó: el `m4a` remoto reporta mal su duración hasta cargar entero.
    const duracion = now.durationS > 0 ? now.durationS : durationS;
    return (
      <VistaDeNota
        mia={props.mia}
        onda={props.onda}
        author={props.author}
        sonando={now.playing}
        ms={now.playing || now.currentS > 0 ? now.currentS * 1000 : (props.durationMs ?? 0)}
        avance={duracion > 0 ? Math.min(1, now.currentS / duracion) : 0}
        velocidad={now.rate}
        onPlay={toggleVoiceNote}
        onVelocidad={() => setVoiceNoteRate(nextPlaybackRate(now.rate))}
        loading={!now.loaded}
        durationS={duracion}
        onSeek={seekVoiceNote}
      />
    );
  }
  return (
    <VistaDeNota
      mia={props.mia}
      onda={props.onda}
      author={props.author}
      sonando={false}
      ms={props.durationMs ?? 0}
      avance={0}
      velocidad={velocidad}
      onPlay={() => start(null)}
      onVelocidad={() => setVelocidad(nextPlaybackRate(velocidad))}
      durationS={durationS}
      onSeek={start}
    />
  );
}
