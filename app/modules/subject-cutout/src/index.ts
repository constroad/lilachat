import { requireOptionalNativeModule } from 'expo';
import type { Layer, MaskStroke, Rect } from '@lilachat/shared';

/** A layer on top of the sticker, as the shared editor describes it (without its id). */
export type CompositionLayer = Omit<Layer, 'id'>;
export type WorkingPhoto = { uri: string; width: number; height: number };
/** The cutout as shown: the cropped image and which part of the working photo it is (photo pixels). */
export type RefinedCutout = { uri: string; width: number; height: number; box: Rect };

type SubjectCutout = {
  /** `true` once the cutout model is on the phone; otherwise asks Play services and waits (with a limit). */
  prepare(): Promise<boolean>;
  /** The oriented working copy of the photo, at most 1280 px: the mask and the brushes use its pixels. */
  preparePhoto(uri: string): Promise<WorkingPhoto>;
  /** ML Kit's mask over the working copy (soft edges, no loose small pieces). */
  cutout(photoUri: string): Promise<{ uri: string }>;
  /** The photo through the mask (or whole, without one) with the brushes, cropped. JSON as `refineCutout`. */
  refine(request: string): Promise<RefinedCutout>;
  /** The final 512×512 WebP sticker. */
  compose(request: string): Promise<{ uri: string; bytes: number }>;
};

/**
 * Background removal and sticker composition on the phone (José, 20/10).
 * Optional: in a build without the module (or on the web) it is `null` and the
 * editor offers the sticker with the whole photo.
 */
export const subjectCutout = requireOptionalNativeModule<SubjectCutout>('SubjectCutout');

export function refineCutout(request: { photo: string; mask: string | null; strokes: MaskStroke[] }) {
  if (!subjectCutout) return Promise.reject(new Error('Esta versión de la app no arma stickers.'));
  return subjectCutout.refine(JSON.stringify(request));
}

export function composeSticker(request: { image: string; outline: boolean; layers: CompositionLayer[] }) {
  if (!subjectCutout) return Promise.reject(new Error('Esta versión de la app no arma stickers.'));
  return subjectCutout.compose(JSON.stringify(request));
}
