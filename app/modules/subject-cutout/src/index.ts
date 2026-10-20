import { requireOptionalNativeModule } from 'expo';
import type { Layer } from '@lilachat/shared';

/** A layer on top of the sticker, as the shared editor describes it (without its id). */
export type CompositionLayer = Omit<Layer, 'id'>;

type SubjectCutout = {
  /** `true` once the cutout model is on the phone; otherwise asks Play services and waits (with a limit). */
  prepare(): Promise<boolean>;
  /** The photo without its background, cropped to the subject (transparent PNG). */
  cutout(uri: string): Promise<{ uri: string; width: number; height: number }>;
  /** The final 512×512 WebP sticker. */
  compose(request: string): Promise<{ uri: string; bytes: number }>;
};

/**
 * Background removal and sticker composition on the phone (José, 20/10).
 * Optional: in a build without the module (or on the web) it is `null` and the
 * editor offers the sticker with the whole photo.
 */
export const subjectCutout = requireOptionalNativeModule<SubjectCutout>('SubjectCutout');

export function composeSticker(request: { image: string; outline: boolean; layers: CompositionLayer[] }) {
  if (!subjectCutout) return Promise.reject(new Error('Esta versión de la app no arma stickers.'));
  return subjectCutout.compose(JSON.stringify(request));
}
