import * as ImagePicker from 'expo-image-picker';
import { galleryStampOf, type FormPhotoStamp } from '@lilachat/shared';
import type { CameraShot } from '../camara/FormCamera';

/** Native and untouched: `uploadFormPhoto` makes it lighter once (Portal's standard, 28/10). */
const PHOTO_QUALITY = 1;

export type GalleryPick = { shot: CameraShot; stamp: FormPhotoStamp | undefined };

/**
 * A photo from the device (José 06/11). It carries its own date and place when the file has them;
 * `plain` goes unstamped: a transfer receipt is a screenshot (E2E 28/10).
 */
export async function pickFromGallery(plain: boolean): Promise<GalleryPick | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: PHOTO_QUALITY, allowsEditing: false, exif: !plain });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;
  return { shot: { uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg' }, stamp: plain ? undefined : galleryStampOf(asset.exif, new Date()) };
}
