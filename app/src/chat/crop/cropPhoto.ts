import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import type { FotoElegida } from '../envioDeFotos';
import { isWholeImage, toPixels, type Rect, type Rotation } from './cropMath';

/** Wide enough for a phone screen: the crop screen draws this, never the 12 MP photo (~48 MB decoded). */
const PREVIEW_WIDTH = 1080;
/** The cut is saved almost untouched: the send queue makes it lighter afterwards, unless «HD». */
const SAVE_QUALITY = 0.92;

export type CropPreview = { image: ImageRef; width: number; height: number; release: () => void };

/**
 * The photo as the manipulator sees it, small: what the crop screen shows is
 * exactly what gets cut (same decoder, same orientation).
 */
export async function loadCropPreview(photo: FotoElegida): Promise<CropPreview> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (!photo.width || photo.width > PREVIEW_WIDTH) context.resize({ width: PREVIEW_WIDTH });
  const image = await context.renderAsync();
  return {
    image,
    width: image.width,
    height: image.height,
    release: () => {
      image.release();
      context.release();
    },
  };
}

/** The photo turned and cut from the full-size original; untouched, it goes back as it was. */
export async function cropPhoto(photo: FotoElegida, fraction: Rect, rotation: Rotation): Promise<FotoElegida> {
  if (isWholeImage(fraction, rotation)) return photo;
  const turning = ImageManipulator.manipulate(photo.uri).rotate(rotation);
  const turned = await turning.renderAsync();
  try {
    const cutting = ImageManipulator.manipulate(turned).crop(toPixels(fraction, turned.width, turned.height));
    const cut = await cutting.renderAsync();
    try {
      const png = photo.mimeType === 'image/png';
      const saved = await cut.saveAsync({ compress: SAVE_QUALITY, format: png ? SaveFormat.PNG : SaveFormat.JPEG });
      return { uri: saved.uri, fileName: croppedName(photo.fileName, png), mimeType: png ? 'image/png' : 'image/jpeg', width: saved.width, height: saved.height };
    } finally {
      cut.release();
      cutting.release();
    }
  } finally {
    turned.release();
    turning.release();
  }
}

function croppedName(fileName: string | null | undefined, png: boolean): string {
  const base = (fileName ?? 'foto').replace(/\.[^.]+$/, '');
  return `${base}-recorte.${png ? 'png' : 'jpg'}`;
}
