import { VIDEO_STICKER_MAX_MS, VIDEO_STICKER_MIN_MS } from '@lilachat/shared';

/**
 * The part of a video a sticker keeps (José 26/11, design ss-01): a window of
 * 0.5 to 6 seconds that the finger slides along the strip or stretches from
 * either edge. Pure: the strip only draws what these say.
 */
export type TrimWindow = { startMs: number; endMs: number };
export type TrimEdge = 'start' | 'end';

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
/** The preview may run a bit past the window before it jumps back (one time update late). */
const LOOP_TOLERANCE_MS = 120;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The first window of a video: from its start, as long as allowed. Null when the video is too short to be a sticker. */
export function initialTrim(videoMs: number): TrimWindow | null {
  if (!Number.isFinite(videoMs) || videoMs < VIDEO_STICKER_MIN_MS) return null;
  return { startMs: 0, endMs: Math.round(Math.min(videoMs, VIDEO_STICKER_MAX_MS)) };
}

/** The whole window moved by `deltaMs`, its length kept, inside the video. */
export function slideTrim(from: TrimWindow, deltaMs: number, videoMs: number): TrimWindow {
  const length = from.endMs - from.startMs;
  const startMs = Math.round(clamp(from.startMs + deltaMs, 0, Math.max(0, videoMs - length)));
  return { startMs, endMs: startMs + length };
}

/** One edge moved by `deltaMs`: the window stays between half a second and 6 seconds, inside the video. */
export function resizeTrim(from: TrimWindow, edge: TrimEdge, deltaMs: number, videoMs: number): TrimWindow {
  if (edge === 'start') {
    const earliest = Math.max(0, from.endMs - VIDEO_STICKER_MAX_MS);
    return { startMs: Math.round(clamp(from.startMs + deltaMs, earliest, from.endMs - VIDEO_STICKER_MIN_MS)), endMs: from.endMs };
  }
  const latest = Math.min(videoMs, from.startMs + VIDEO_STICKER_MAX_MS);
  return { startMs: from.startMs, endMs: Math.round(clamp(from.endMs + deltaMs, from.startMs + VIDEO_STICKER_MIN_MS, latest)) };
}

/** Pixels the finger moved on the strip → milliseconds of video. */
export function msOfDistance(px: number, stripWidth: number, videoMs: number): number {
  return stripWidth > 0 && videoMs > 0 ? (px / stripWidth) * videoMs : 0;
}

/** Where the window sits on a strip `stripWidth` wide. */
export function trimFrame(trim: TrimWindow, stripWidth: number, videoMs: number): { left: number; width: number } {
  if (stripWidth <= 0 || videoMs <= 0) return { left: 0, width: 0 };
  return { left: (trim.startMs / videoMs) * stripWidth, width: ((trim.endMs - trim.startMs) / videoMs) * stripWidth };
}

/** «0:12», like the video players. */
export function formatClipClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  return `${minutes}:${String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

/** «6 s» or «2,5 s»: the window's length, one decimal at most, with a comma. */
export function formatClipLength(ms: number): string {
  const tenths = Math.round(ms / (MS_PER_SECOND / 10)) / 10;
  return `${String(tenths).replace('.', ',')} s`;
}

/** What the trim card says: «6 s seleccionados» and «0:12 – 0:18». */
export function trimSummary(trim: TrimWindow): { length: string; range: string } {
  return { length: `${formatClipLength(trim.endMs - trim.startMs)} seleccionados`, range: `${formatClipClock(trim.startMs)} – ${formatClipClock(trim.endMs)}` };
}

/** The preview plays only the window: past its end (or before its start) it jumps back. */
export function shouldLoopBack(currentMs: number, trim: TrimWindow): boolean {
  return currentMs >= trim.endMs || currentMs < trim.startMs - LOOP_TOLERANCE_MS;
}

/** The moments (in seconds) of the strip's frames: the middle of each of `count` equal parts. */
export function stripFrameTimes(videoMs: number, count: number): number[] {
  if (videoMs <= 0 || count <= 0) return [];
  const part = videoMs / count;
  return Array.from({ length: count }, (_, index) => Math.round(part * (index + 0.5)) / MS_PER_SECOND);
}
