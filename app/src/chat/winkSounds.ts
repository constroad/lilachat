import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { WinkSound } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';

const WINK_VOLUME = 0.7;

/** Our own synthesized sounds (MP3, the same files as the web): the music beds and the sketches' effects. */
const SOUND_FILES: Record<WinkSound, number> = {
  chime: require('../../assets/sonidos/wink-chime.mp3'),
  pop: require('../../assets/sonidos/wink-pop.mp3'),
  clap: require('../../assets/sonidos/wink-clap.mp3'),
  horn: require('../../assets/sonidos/wink-horn.mp3'),
  groove: require('../../assets/sonidos/wink-groove.mp3'),
  rock: require('../../assets/sonidos/wink-rock.mp3'),
  ting: require('../../assets/sonidos/wink-ting.mp3'),
  boing: require('../../assets/sonidos/wink-boing.mp3'),
  smooch: require('../../assets/sonidos/wink-smooch.mp3'),
  whoosh: require('../../assets/sonidos/wink-whoosh.mp3'),
  splash: require('../../assets/sonidos/wink-splash.mp3'),
  drip: require('../../assets/sonidos/wink-drip.mp3'),
  knock: require('../../assets/sonidos/wink-knock.mp3'),
  glass: require('../../assets/sonidos/wink-glass.mp3'),
  thump: require('../../assets/sonidos/wink-thump.mp3'),
  squeeze: require('../../assets/sonidos/wink-squeeze.mp3'),
  cheer: require('../../assets/sonidos/wink-cheer.mp3'),
  partyhorn: require('../../assets/sonidos/wink-partyhorn.mp3'),
  laugh: require('../../assets/sonidos/wink-laugh.mp3'),
  yawn: require('../../assets/sonidos/wink-yawn.mp3'),
  snore: require('../../assets/sonidos/wink-snore.mp3'),
  alarm: require('../../assets/sonidos/wink-alarm.mp3'),
  rumble: require('../../assets/sonidos/wink-rumble.mp3'),
  sizzle: require('../../assets/sonidos/wink-sizzle.mp3'),
  whistle: require('../../assets/sonidos/wink-whistle.mp3'),
  crash: require('../../assets/sonidos/wink-crash.mp3'),
};
/** The players playing now. Each one is released when it ends: 26 sounds kept alive were 26 media players in memory (José, 21/10: the app felt slow). */
const playing = new Set<AudioPlayer>();

function release(player: AudioPlayer): void {
  playing.delete(player);
  try {
    player.release();
  } catch (error) {
    reportarError('releaseWinkSound', error);
  }
}

/** Never throws: a sound that fails cannot break the chat. */
export function playWinkSound(sound: WinkSound): void {
  try {
    const player = createAudioPlayer(SOUND_FILES[sound]);
    playing.add(player);
    player.volume = WINK_VOLUME;
    const done = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      done.remove();
      release(player);
    });
    player.play();
  } catch (error) {
    reportarError('playWinkSound', error);
  }
}

/** The music of a wink stops with it, and its players go. */
export function stopWinkSounds(): void {
  [...playing].forEach(release);
}
