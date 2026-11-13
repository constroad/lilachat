/**
 * The chat camera's video (José 12/11, design cam-05): three minutes at most, recorded at 720p and
 * about 2.5 Mbps so it already leaves the phone at its final weight (~60 MB for three minutes, under
 * the 90 MB of a chat video). The server burns the stamp in the one pass that encodes it again.
 */
export const MAX_VIDEO_SECONDS = 180;
export const VIDEO_BITRATE = 2_500_000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

const clock = (seconds: number) => `${String(Math.floor(seconds / SECONDS_PER_MINUTE)).padStart(2, '0')}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;

/** «00:42 · máx. 3:00». */
export function recordingLabel(elapsedMs: number): string {
  const seconds = Math.min(MAX_VIDEO_SECONDS, Math.max(0, Math.floor(elapsedMs / MS_PER_SECOND)));
  return `${clock(seconds)} · máx. ${Math.floor(MAX_VIDEO_SECONDS / SECONDS_PER_MINUTE)}:00`;
}
