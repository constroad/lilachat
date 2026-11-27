import * as ImagePicker from 'expo-image-picker';
import { reportarError } from '../../ui/reportarError';
import { stickerSourceKind } from './stickerSource';
import { galleryVideoRefusal, pickedVideoOf, type PickedVideo } from './videoStickerSound';

export type GalleryVideo = PickedVideo & { durationMs?: number };
export type PickedPhoto = { uri: string; width: number; height: number };
export type StickerSource = { kind: 'photo'; photo: PickedPhoto } | { kind: 'clip'; clip: GalleryVideo };

/**
 * «Crear» (José 26/11, design sc-01a): one photo, video or GIF of the gallery,
 * untouched. A photo goes to the cutout editor; a video or a GIF to the clip
 * editor with sound (the window is chosen there).
 */
export async function pickStickerSource(): Promise<StickerSource | { refusal: string } | null> {
  try {
    // gates-allow: camara the media is only the source of a 512 sticker: no stamp, no chat compression (a GIF must stay animated)
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsEditing: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return null;
    if (stickerSourceKind(asset) === 'photo') return { kind: 'photo', photo: { uri: asset.uri, width: asset.width, height: asset.height } };
    const refusal = galleryVideoRefusal(asset);
    if (refusal) return { refusal };
    return { kind: 'clip', clip: { ...pickedVideoOf(asset), durationMs: asset.duration ?? undefined } };
  } catch (error) {
    reportarError('pickStickerSource', error);
    return { refusal: 'No se pudo abrir la galería.' };
  }
}
