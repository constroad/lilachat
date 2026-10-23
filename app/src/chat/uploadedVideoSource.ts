import type { VideoSource } from 'expo-video';

/**
 * What the player gets for an uploaded video (pending 74): the file and what
 * the notification shows while it keeps playing with the screen off or in
 * another app — «Video», the chat it came from and its cover.
 */
export function uploadedVideoSource(params: { url: string; poster?: string; chatTitle?: string }): Exclude<VideoSource, string | number | null> {
  return {
    uri: params.url,
    metadata: { title: 'Video', artist: params.chatTitle || 'Lilachat', ...(params.poster ? { artwork: params.poster } : {}) },
  };
}
