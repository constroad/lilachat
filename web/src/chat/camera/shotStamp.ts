import type { TimemarkStampAsked } from '@lilachat/shared';

/** What the browser offers: camera access, and a finger rather than a mouse (a phone). */
export type CameraEnvironment = { media: boolean; coarse: boolean };

/** In order: an iPhone records MP4, Android Chrome WebM. The server turns either into MP4 while it burns the stamp. */
const RECORDER_TYPES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

/** Lilachat's camera on a phone browser; a computer, or a field that takes the gallery, keeps the file picker. */
export function liveCameraFits(environment: CameraEnvironment, field: { gallery?: boolean }): boolean {
  return environment.media && environment.coarse && !field.gallery;
}

export function recorderTypeOf(supports: (type: string) => boolean): string | null {
  const found = RECORDER_TYPES.find((type) => supports(type));
  return found ? found.split(';')[0]! : null;
}

/** «foto-…jpg», «video-…mp4» or «video-…webm», as the APK names its shots. */
export function shotNameOf(mime: string, at: number): string {
  const plain = mime.split(';')[0]!;
  const kind = plain.startsWith('video/') ? 'video' : 'foto';
  const extension = plain === 'image/jpeg' ? 'jpg' : plain.split('/')[1];
  return `${kind}-${at}.${extension}`;
}

/** The stamp rides beside the file to whoever uploads it: the server burns it, never the browser. */
const stamps = new WeakMap<File, TimemarkStampAsked>();

export function withStamp(file: File, stamp: TimemarkStampAsked): File {
  stamps.set(file, stamp);
  return file;
}

export const stampOfFile = (file: File): TimemarkStampAsked | undefined => stamps.get(file);

/** This browser, now. */
export function cameraEnvironment(): CameraEnvironment {
  const media = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
  return { media, coarse };
}
