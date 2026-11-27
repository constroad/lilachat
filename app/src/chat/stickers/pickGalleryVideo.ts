import * as ImagePicker from 'expo-image-picker';
import { reportarError } from '../../ui/reportarError';
import { galleryVideoRefusal, pickedVideoOf, type PickedVideo } from './videoStickerSound';

export type GalleryVideo = PickedVideo & { durationMs?: number };

/** «Desde un video» (José 26/11): one video of the gallery, untouched (the window is chosen in the editor). */
export async function pickGalleryVideo(): Promise<{ video: GalleryVideo } | { refusal: string } | null> {
  try {
    // gates-allow: camara the video is only the source of a 512 sticker the server cuts: no stamp, no chat compression
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, allowsEditing: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return null;
    const refusal = galleryVideoRefusal(asset);
    if (refusal) return { refusal };
    return { video: { ...pickedVideoOf(asset), durationMs: asset.duration ?? undefined } };
  } catch (error) {
    reportarError('pickGalleryVideo', error);
    return { refusal: 'No se pudo abrir la galería.' };
  }
}
