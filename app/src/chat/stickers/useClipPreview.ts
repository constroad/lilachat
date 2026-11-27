import { useEffect, useRef, useState } from 'react';
import { useVideoPlayer, type VideoThumbnail } from 'expo-video';
import { shouldLoopBack, stripFrameTimes, type TrimWindow } from './videoStickerTrim';

const MS_PER_SECOND = 1_000;
/** How often the preview reports where it is (s): often enough to loop the window on time. */
const TIME_UPDATE_S = 0.1;
const STRIP_FRAMES = 8;
const FRAME_MAX_WIDTH = 96;

/**
 * The live preview of the sticker (design ss-01): the video plays only the
 * chosen window, over and over, muted. `listen()` plays the window once with
 * the video's own sound. It also knows the video's length when the picker did
 * not, and the frames of the trim strip.
 */
export function useClipPreview(uri: string, trim: TrimWindow | null) {
  const player = useVideoPlayer(uri, (created) => {
    created.loop = true;
    created.muted = true;
    created.timeUpdateEventInterval = TIME_UPDATE_S;
    created.play();
  });
  const [loadedMs, setLoadedMs] = useState(0);
  const [frames, setFrames] = useState<VideoThumbnail[]>([]);
  const [listening, setListening] = useState(false);
  const latest = useRef({ trim, listening });
  latest.current = { trim, listening };

  useEffect(() => {
    const loaded = (seconds: number) => {
      if (seconds <= 0) return;
      const ms = Math.round(seconds * MS_PER_SECOND);
      setLoadedMs(ms);
      player
        .generateThumbnailsAsync(stripFrameTimes(ms, STRIP_FRAMES), { maxWidth: FRAME_MAX_WIDTH })
        .then(setFrames)
        // Expected on some files: expo-video parses an empty frame count and throws. The plain strip stays.
        .catch((error: unknown) => console.warn('[stickers] strip frames unavailable:', error instanceof Error ? error.message : String(error)));
    };
    const onLoad = player.addListener('sourceLoad', (payload) => loaded(payload.duration));
    if (player.duration > 0) loaded(player.duration);
    return () => onLoad.remove();
  }, [player]);

  useEffect(() => {
    const onTime = player.addListener('timeUpdate', (payload) => {
      const window = latest.current.trim;
      if (!window || !shouldLoopBack(payload.currentTime * MS_PER_SECOND, window)) return;
      player.currentTime = window.startMs / MS_PER_SECOND;
      // One pass with sound is enough: back to the quiet loop.
      if (latest.current.listening) setListening(false);
    });
    return () => onTime.remove();
  }, [player]);

  useEffect(() => {
    player.muted = !listening;
  }, [player, listening]);

  /** Back to the window's start: after the finger lets the strip go. */
  const restart = (window: TrimWindow) => {
    player.currentTime = window.startMs / MS_PER_SECOND;
    player.play();
  };
  const listen = () => {
    if (trim) restart(trim);
    setListening(true);
  };
  const pause = () => {
    setListening(false);
    player.pause();
  };

  return { player, loadedMs, frames, listening, listen, quiet: () => setListening(false), restart, pause };
}
