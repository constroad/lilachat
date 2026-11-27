import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { Volume2, VolumeX } from 'lucide-react-native';
import { stickerHasSound } from '@lilachat/shared';
import { reportarError } from '../../ui/reportarError';
import { useColores } from '../../ui/tema';
import { createStickerSoundController, stickerSoundKey, type LoopPlayer } from './stickerSoundController';

/** One expo-audio player per tap, released when the three plays end or the sound is stopped. */
function createExpoLoopPlayer(url: string, onFinished: () => void): LoopPlayer {
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

/** The session's only sticker sound: a second sticker stops the first (José 26/11). */
const stickerSound = createStickerSoundController(createExpoLoopPlayer, reportarError);

/**
 * A sticker's sound in the chat: muted until its speaker is tapped, never by
 * itself. It stops when the message leaves the screen.
 */
export function useStickerSound(message: { chatId: string; seq: number } | null, media: { audioUrl?: string | null } | null | undefined) {
  const messageId = message ? stickerSoundKey(message) : '';
  const audioUrl = message && stickerHasSound(media) ? (media!.audioUrl as string) : null;
  const playing = useSyncExternalStore(stickerSound.subscribe, () => audioUrl !== null && stickerSound.playingId() === messageId);
  useEffect(() => () => stickerSound.stop(messageId), [messageId]);
  const toggle = () => {
    if (audioUrl) stickerSound.toggle(messageId, audioUrl);
  };
  return { hasSound: audioUrl !== null, playing, toggle };
}

/** Size of the speaker button (dp); its hit slop takes the touch target past 44. */
const BUTTON_SIDE = 36;
const BUTTON_HIT_SLOP = 8;
/** How far the playing ring reaches past the sticker (design ss-03). */
const RING_OUTSET = 6;

/** The speaker in the sticker's corner (design ss-03): muted at rest, the accent while it sounds. */
export function StickerSoundButton(props: { playing: boolean; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable
      testID="sticker-sonido"
      accessibilityRole="button"
      accessibilityLabel={props.playing ? 'Detener el sonido del sticker' : 'Escuchar el sonido del sticker'}
      accessibilityState={{ selected: props.playing }}
      onPress={props.onPress}
      hitSlop={BUTTON_HIT_SLOP}
      className={`absolute bottom-0 right-0 items-center justify-center rounded-full ${props.playing ? 'border-[1.5px] border-primary bg-surface' : 'bg-black/55'}`}
      style={{ width: BUTTON_SIDE, height: BUTTON_SIDE }}
    >
      {props.playing ? <Volume2 size={18} color={colors.primary} /> : <VolumeX size={18} color="white" />}
    </Pressable>
  );
}

/** The ring around a sticker while its sound plays (design ss-03). */
export function StickerSoundRing() {
  return <View pointerEvents="none" className="absolute rounded-full border-2 border-primary/60" style={{ top: -RING_OUTSET, left: -RING_OUTSET, right: -RING_OUTSET, bottom: -RING_OUTSET }} />;
}

export type StickerSoundState = ReturnType<typeof useStickerSound>;

/** The ring and the speaker over a sticker with sound: the same in the chat, a channel row and a thread. */
export function StickerSoundOverlay(props: { sound: StickerSoundState; hidden?: boolean }) {
  if (!props.sound.hasSound) return null;
  return (
    <>
      {props.sound.playing ? <StickerSoundRing /> : null}
      {props.hidden ? null : <StickerSoundButton playing={props.sound.playing} onPress={props.sound.toggle} />}
    </>
  );
}
