/**
 * The video in the mini player (pending 14, like WhatsApp Web): it keeps
 * playing after the viewer closes or the chat changes. One at a time; the
 * player lives at the root of the app, outside any chat.
 */
export type MiniVideo = { url: string; poster?: string; startAt: number; title: string };

let current: MiniVideo | null = null;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

export function openMiniPlayer(video: MiniVideo): void {
  current = { ...video, startAt: Number.isFinite(video.startAt) && video.startAt > 0 ? video.startAt : 0 };
  announce();
}

export function closeMiniPlayer(): void {
  current = null;
  announce();
}

export const miniPlayerVideo = (): MiniVideo | null => current;

export function subscribeMiniPlayer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
