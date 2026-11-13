import { HOUR_STAMP, TIMEMARK_STAMP, takenAtFrom, type GeoPoint } from '@lilachat/shared';
import type { PhotoStampAsked } from './botForms.js';

/** A reading of the phone's GPS sent as form fields; anything off the map is no reading. */
export function pointOf(fields: Record<string, unknown>): GeoPoint | null {
  const [lat, lng, precision] = [fields.lat, fields.lng, fields.precision].map(Number);
  const valid = [lat, lng, precision].every(Number.isFinite) && Math.abs(lat!) <= 90 && Math.abs(lng!) <= 180 && precision! >= 0;
  return valid ? { lat: lat!, lng: lng!, precision: Math.round(precision!) } : null;
}

/** The camera's Timemark-like stamp (José 12/11); a photo the queue sends later says when it was taken. */
function timemarkAsked(fields: Record<string, unknown>): PhotoStampAsked {
  const takenAt = takenAtFrom(fields.takenAt, new Date());
  const location = pointOf(fields);
  return { timemark: { logo: fields.logo === '1' }, ...(location ? { location } : {}), ...(takenAt ? { takenAt } : {}) };
}

/** What an upload asks the server to burn into a photo or a video (pending 94; forms and the chat's camera). */
export function stampAskedOf(body: unknown): PhotoStampAsked | undefined {
  const fields = (body ?? {}) as Record<string, unknown>;
  if (fields.stamp === HOUR_STAMP) return { hourOnly: true };
  // A photo of the gallery burns only its date; a place sent with it is ignored (José 07/11).
  if (fields.stamp === 'taken') {
    const takenAt = takenAtFrom(fields.takenAt, new Date());
    return takenAt ? { takenAt } : { hourOnly: true };
  }
  if (fields.stamp === TIMEMARK_STAMP) return timemarkAsked(fields);
  if (fields.stamp !== '1') return undefined;
  const location = pointOf(fields);
  return location ? { location } : {};
}
