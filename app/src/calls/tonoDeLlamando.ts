import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { reportarError } from '../ui/reportarError';

/**
 * The ringback tone while I call (José, 20/10: there was no sound when
 * calling): 425 Hz, 1 s on and 4 s off, Peru's tone. It is our own file
 * (`assets/sonidos/llamando.m4a`, generated, no license; m4a since 0.1.175,
 * 6 KB instead of a 160 KB wav), looped; it stops on answer, reject or hang
 * up. It never throws: a failing tone cannot bring the call down.
 */
let reproductor: AudioPlayer | null = null;

export function iniciarTonoDeLlamando(): void {
  try {
    reproductor ??= createAudioPlayer(require('../../assets/sonidos/llamando.m4a'));
    reproductor.loop = true;
    reproductor.volume = 0.6;
    void reproductor.seekTo(0);
    reproductor.play();
  } catch (error) {
    reportarError('iniciarTonoDeLlamando', error);
  }
}

export function detenerTonoDeLlamando(): void {
  try {
    reproductor?.pause();
  } catch (error) {
    reportarError('detenerTonoDeLlamando', error);
  }
}
