import { HOUR_STAMP, type FormPhotoStamp, type GalleryStamp } from './appActions.js';
import type { GeoPoint } from './appForms.js';

/**
 * What a form's photo asks the server to burn into it (José 06/11: the tank and the materials carry
 * their date and hour). A camera shot takes the server's clock and the place read right now; a photo
 * of the gallery keeps only the date it was taken, never the moment it is uploaded, and no place
 * (José 07/11). PURE: the app, the web and the server.
 */
export type ExifData = Record<string, unknown>;

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
/** A camera writes its local time with no zone; these phones are in Peru. */
const PERU_OFFSET = '-05:00';
/** Older than this is a broken clock, not a photo of the job. */
const OLDEST_PHOTO = Date.UTC(2000, 0, 1);
/** A phone's clock can run a little ahead of the server's. */
const CLOCK_SLACK_MS = 5 * 60_000;

export const cameraStampOf = (point: GeoPoint | null): FormPhotoStamp => point ?? HOUR_STAMP;

export function exifTakenAtOf(exif: ExifData | null | undefined): string | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime;
  const parts = typeof raw === 'string' ? EXIF_DATE.exec(raw) : null;
  if (!parts) return null;
  const [, year, month, day, hour, minute, second] = parts;
  const time = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${PERU_OFFSET}`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Only the date (José 07/11): the place of a photo comes only from the camera, read right now. */
export function galleryStampOf(exif: ExifData | null | undefined, fallback: Date): GalleryStamp {
  return { takenAt: exifTakenAtOf(exif) ?? fallback.toISOString() };
}

const pointFields = (point: GeoPoint) => ({ lat: String(point.lat), lng: String(point.lng), precision: String(point.precision) });

/** The fields of the upload that ask for the stamp. */
export function stampFieldsOf(stamp: FormPhotoStamp | undefined): Record<string, string> {
  if (!stamp) return {};
  if (stamp === HOUR_STAMP) return { stamp: HOUR_STAMP };
  if ('takenAt' in stamp) return { stamp: 'taken', takenAt: stamp.takenAt };
  return { stamp: '1', ...pointFields(stamp) };
}

/** The date a photo says it has, when it can be true. */
export function takenAtFrom(value: unknown, now: Date): Date | null {
  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time) || time < OLDEST_PHOTO || time > now.getTime() + CLOCK_SLACK_MS) return null;
  return new Date(time);
}

/** What a browser file carries: its own date, no place. A file marked plain goes unstamped; a camera-only field burns the hour. */
export function fileStampOf(field: { gallery?: boolean; plainGallery?: true }, lastModified: number): FormPhotoStamp | undefined {
  if (field.plainGallery) return undefined;
  return field.gallery ? { takenAt: new Date(lastModified).toISOString() } : HOUR_STAMP;
}
