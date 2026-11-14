import type { FormField } from '@lilachat/shared';
import type { PhotoStampAsked } from './botForms.js';

/**
 * Where and when a form's photo was taken, kept with the file (José 13/11: the
 * field reports place every photo on their sketch). Only the camera's reading
 * gives a place: a gallery photo keeps its date alone (José 07/11).
 */
export type PhotoPlace = { point?: { lat: number; lng: number; precision: number }; takenAt?: Date };
/** What the app hears beside `values`, one entry per photo, matched by its address. */
export type SubmittedPhoto = { field: string; url: string; taken_at?: string; lat?: number; lng?: number; precision_m?: number };
/** A photo id of THIS form → its signed address and place; null for anything else. */
export type PhotoSigner = (fileId: unknown) => (PhotoPlace & { url: string }) | null;

/** The place and the hour an upload asked for, as the file keeps them. */
export function placeOfStamp(stamp: PhotoStampAsked | undefined, now: Date = new Date()): PhotoPlace {
  const location = stamp?.location;
  const point = location ? { point: { lat: location.lat, lng: location.lng, precision: location.precision } } : {};
  return { ...point, takenAt: stamp?.takenAt ?? now };
}

function submittedPhotoOf(field: string, file: PhotoPlace & { url: string }): SubmittedPhoto {
  const point = file.point ? { lat: file.point.lat, lng: file.point.lng, precision_m: file.point.precision } : {};
  return { field, url: file.url, ...(file.takenAt ? { taken_at: file.takenAt.toISOString() } : {}), ...point };
}

/** A photo field's value signed: a list keeps only this form's photos; a single foreign id is no value. */
function signedValueOf(value: unknown, field: string, sign: PhotoSigner, photos: SubmittedPhoto[]): string | string[] | undefined {
  const one = (fileId: unknown): string | null => {
    const file = sign(fileId);
    if (!file) return null;
    photos.push(submittedPhotoOf(field, file));
    return file.url;
  };
  if (Array.isArray(value)) return value.map(one).filter((url): url is string => url !== null);
  return one(value) ?? undefined;
}

/**
 * The photo fields' ids → their signed addresses, a list's items too (28/10).
 * The places go apart, in `photos`, so an app that reads a photo as a text
 * keeps working. PURE: the signer brings the files.
 */
export function signPhotoValues(fields: readonly FormField[], raw: Record<string, unknown>, sign: PhotoSigner, prefix = '', photos: SubmittedPhoto[] = []): { values: Record<string, unknown>; photos: SubmittedPhoto[] } {
  const values = { ...raw };
  for (const field of fields) {
    const path = `${prefix}${field.name}`;
    const value = values[field.name];
    if (field.kind === 'list' && Array.isArray(value)) {
      values[field.name] = value.map((item, index) => (item && typeof item === 'object' ? signPhotoValues(field.fields, item as Record<string, unknown>, sign, `${path}[${index}].`, photos).values : item));
    }
    if (field.kind !== 'photo') continue;
    const signed = signedValueOf(value, path, sign, photos);
    if (signed === undefined) delete values[field.name];
    else values[field.name] = signed;
  }
  return { values, photos };
}

/** The places of the photos still among the answers: a photo of a field that ended hidden does not travel. */
export function photosAmong(photos: readonly SubmittedPhoto[], values: unknown): SubmittedPhoto[] {
  const urls = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string') urls.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(values);
  return photos.filter((photo) => urls.has(photo.url));
}
