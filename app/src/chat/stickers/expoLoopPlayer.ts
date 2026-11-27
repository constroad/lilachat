import { createAudioPlayer } from 'expo-audio';
import type { LoopPlayer } from './stickerSoundController';

/** One expo-audio player per play, released when the plays end or the sound is stopped. */
export function createExpoLoopPlayer(url: string, onFinished: () => void): LoopPlayer {
  const player = createAudioPlayer({ uri: url });
  const finishing = player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) onFinished();
  });
  return {
    play: () => player.play(),
    rewind: () => void player.seekTo(0),
    release: () => {
      finishing.remove();
      player.pause();
      player.release();
    },
  };
}
