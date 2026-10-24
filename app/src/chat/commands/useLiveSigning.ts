import { useState, type RefObject } from 'react';
import type { FormField, FormValues } from '@lilachat/shared';
import { freshPoint, withAge } from '../location/freshPoint';
import type { PhotoUpload } from './AppFormFields';
import type { LiveSelfieHandle } from './LiveSelfie';

type Phase = 'locating' | 'photo' | 'uploading' | 'sending';
const PHASE_LABEL: Record<Phase, string> = { locating: 'Leyendo tu ubicación…', photo: 'Tomando la foto…', uploading: 'Subiendo la foto…', sending: 'Enviando…' };
/** Stands in for the photo and the place while the rest of the form is checked: both are taken at the tap. */
const LIVE_PLACEHOLDER = 'live';
const PLACE_PLACEHOLDER = { lat: 0, lng: 0, precision: 1 };

/**
 * The one tap of a signing (pending 94; José, 24/10: «con cámara prendida y
 * ubicación actual»): a fresh reading of where the person is (never the cached
 * one), the photo from the live camera, its upload with the stamp request, and
 * the values ready to send. A form without a live selfie goes as it is.
 */
export function useLiveSigning(params: { live: Pick<FormField, 'name'> | null; locationName?: string; selfie: RefObject<LiveSelfieHandle | null>; upload: PhotoUpload }) {
  const { live, locationName, selfie, upload } = params;
  const [phase, setPhase] = useState<Phase>('sending');
  const placeholders = (values: FormValues): FormValues => (live && locationName ? { ...values, [live.name]: LIVE_PLACEHOLDER, [locationName]: values[locationName] ?? PLACE_PLACEHOLDER } : values);
  const prepare = async (values: FormValues): Promise<{ values: FormValues } | { errors: Record<string, string> }> => {
    if (!live || !locationName) return { values };
    setPhase('locating');
    const point = await freshPoint();
    if (!point) return { errors: { [locationName]: 'No se pudo leer tu ubicación de ahora. Revisa el GPS o sal a cielo abierto, y vuelve a marcar.' } };
    setPhase('photo');
    const shot = await selfie.current?.capture();
    if (!shot) return { errors: { [live.name]: 'No se pudo tomar la foto: la cámara tiene que estar prendida.' } };
    setPhase('uploading');
    const sentPoint = withAge(point);
    const uploaded = await upload(shot, sentPoint);
    if (!uploaded.ok) return { errors: { [live.name]: uploaded.message } };
    setPhase('sending');
    return { values: { ...values, [locationName]: withAge(point), [live.name]: uploaded.fileId } };
  };
  return { placeholders, prepare, phaseLabel: PHASE_LABEL[phase] };
}
