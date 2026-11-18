import { useCallback, useState, type ReactElement } from 'react';
import { Linking } from 'react-native';
import { videoEmbedFor, type VideoEmbed } from '@lilachat/shared';
import { VideoEmbedPlayer } from '../VideoEmbedPlayer';

/** A saved link opened like the chat's link cards: a reel plays inside Lilachat, a page goes to the browser. */
export function useLinkOpener(): { open: (url: string) => void; player: ReactElement } {
  const [playing, setPlaying] = useState<{ video: VideoEmbed; url: string } | null>(null);
  const open = useCallback((url: string) => {
    const video = videoEmbedFor(url);
    if (video) return setPlaying({ video, url });
    Linking.openURL(url).catch((error: unknown) => console.warn('[links] could not open the link:', error instanceof Error ? error.message : error));
  }, []);
  const player = <VideoEmbedPlayer video={playing?.video ?? null} link={playing?.url ?? ''} onClose={() => setPlaying(null)} />;
  return { open, player };
}
