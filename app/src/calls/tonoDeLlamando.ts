import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { reportarError } from '../ui/reportarError';

/**
 * El «tuu… tuu» mientras llamo (José, 20/10: «no hay sonido cuando hago una
 * llamada»): 425 Hz, 1 s sí y 4 s no, el tono de llamada de Perú. Es un
 * archivo propio (`assets/sonidos/llamando.wav`, generado, sin licencias) en
 * bucle; se corta al contestar, rechazar o colgar. Nunca lanza: un tono que
 * falla no puede tumbar la llamada.
 */
let reproductor: AudioPlayer | null = null;

export function iniciarTonoDeLlamando(): void {
  try {
    reproductor ??= createAudioPlayer(require('../../assets/sonidos/llamando.wav'));
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
