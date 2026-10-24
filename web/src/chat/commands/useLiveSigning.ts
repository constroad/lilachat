import { useState, type RefObject } from 'react';
import { geoPointOf, type FormField, type FormValues, type GeoPoint } from '@lilachat/shared';
import type { LiveSelfieHandle } from './LiveSelfie';

type Phase = 'locating' | 'photo' | 'uploading' | 'sending';
const PHASE_LABEL: Record<Phase, string> = { locating: 'Leyendo tu ubicación…', photo: 'Tomando la foto…', uploading: 'Subiendo la foto…', sending: 'Enviando…' };
const FIX_TIMEOUT_MS = 15_000;
/** A reading older than this is the browser's cache, not «now». */
const FRESH_FIX_MS = 30_000;
const LIVE_PLACEHOLDER = 'live';
const PLACE_PLACEHOLDER = { lat: 0, lng: 0, precision: 1 };

type Upload = (file: File, stamp?: GeoPoint) => Promise<{ ok: true; fileId: string } | { ok: false; message: string }>;

/** Where the person is RIGHT NOW (José, 24/10): `maximumAge: 0`, and a reading that came back old is refused. */
function freshPoint(): Promise<(GeoPoint & { readAt: number }) | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(Date.now() - position.timestamp > FRESH_FIX_MS ? null : { ...geoPointOf(position.coords), readAt: position.timestamp }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: FIX_TIMEOUT_MS, maximumAge: 0 }
    );
  });
}

const withAge = (point: GeoPoint & { readAt: number }): GeoPoint => ({ lat: point.lat, lng: point.lng, precision: point.precision, age: Math.max(0, Date.now() - point.readAt) });

/**
 * The one click of a signing on the web (pending 94): the place of now, the
 * frame of the live camera, its upload with the stamp request and the values
 * ready to send. A form without a live selfie goes as it is.
 */
export function useLiveSigning(params: { live: Pick<FormField, 'name'> | null; locationName?: string; selfie: RefObject<LiveSelfieHandle | null>; upload: Upload }) {
  const { live, locationName, selfie, upload } = params;
  const [phase, setPhase] = useState<Phase>('sending');
  const placeholders = (values: FormValues): FormValues => (live && locationName ? { ...values, [live.name]: LIVE_PLACEHOLDER, [locationName]: values[locationName] ?? PLACE_PLACEHOLDER } : values);
  const prepare = async (values: FormValues): Promise<{ values: FormValues } | { errors: Record<string, string> }> => {
    if (!live || !locationName) return { values };
    setPhase('locating');
    const point = await freshPoint();
    if (!point) return { errors: { [locationName]: 'No se pudo leer tu ubicación de ahora. Permite la ubicación y vuelve a marcar.' } };
    setPhase('photo');
    const shot = await selfie.current?.capture();
    if (!shot) return { errors: { [live.name]: 'No se pudo tomar la foto: la cámara tiene que estar prendida.' } };
    setPhase('uploading');
    const uploaded = await upload(shot, withAge(point));
    if (!uploaded.ok) return { errors: { [live.name]: uploaded.message } };
    setPhase('sending');
    return { values: { ...values, [locationName]: withAge(point), [live.name]: uploaded.fileId } };
  };
  return { placeholders, prepare, phaseLabel: PHASE_LABEL[phase] };
}
