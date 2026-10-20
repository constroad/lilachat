import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { STICKER_COMPOSITION, stickerGeometry, type CutoutView, type MaskStroke } from '@lilachat/shared';
import { composeSticker, refineCutout, subjectCutout, type RefinedCutout, type WorkingPhoto } from '../../../modules/subject-cutout/src';
import { reportarError } from '../../ui/reportarError';

export type CutoutPhase = 'picking' | 'cutting' | 'editing' | 'saving';
const NO_CUTOUT = 'No se pudo quitar el fondo: borra a mano lo que no quieras, o va la foto entera.';
const NO_REFINE = 'No se pudo aplicar el pincel. Inténtalo de nuevo.';

/**
 * ML Kit's mask. The first time Play services downloads the model (a few
 * seconds): `prepare` waits for it with a limit; if it did not arrive the
 * editor says so and the automatic-background switch tries again.
 */
async function automaticMask(photoUri: string): Promise<{ uri: string } | { reason: string }> {
  if (!subjectCutout) return { reason: NO_CUTOUT };
  try {
    if (!(await subjectCutout.prepare())) return { reason: 'El recorte automático se está descargando (solo la primera vez). Mientras, borra a mano lo que no quieras.' };
    return await subjectCutout.cutout(photoUri);
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_NO_SUBJECT') return { reason: 'No encontré a nadie ni nada para recortar: borra a mano lo que no quieras.' };
    reportarError('useStickerCutout.automaticMask', error);
    return { reason: NO_CUTOUT };
  }
}

/** The picked photo as the working copy; without the native module, the photo as it came. */
async function workingPhoto(asset: ImagePicker.ImagePickerAsset): Promise<WorkingPhoto> {
  if (!subjectCutout) return { uri: asset.uri, width: asset.width, height: asset.height };
  return subjectCutout.preparePhoto(asset.uri);
}

/**
 * The cutout of «Crear sticker» (José, 20/10): pick a photo, its working copy,
 * ML Kit's mask, and the image redone after each erase/restore stroke or undo.
 * `view` says where that image sits in the sticker, for the brushes.
 */
export function useStickerCutout(params: { visible: boolean; automatic: boolean; strokes: MaskStroke[]; outline: boolean; onCancel: () => void }) {
  const { visible, automatic, strokes, outline } = params;
  const [phase, setPhase] = useState<CutoutPhase>('picking');
  const [photo, setPhoto] = useState<WorkingPhoto | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [shown, setShown] = useState<RefinedCutout | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  // Opening depends ONLY on `visible`: a new `onCancel` on each render used to reopen the gallery (E2E, 20/10).
  const cancelRef = useRef(params.onCancel);
  cancelRef.current = params.onCancel;

  useEffect(() => {
    if (!visible) return;
    let current = true;
    setPhase('picking');
    setPhoto(null);
    setMask(null);
    setShown(null);
    setPreview(null);
    setNotice('');
    void (async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!current) return;
      if (picked.canceled || !picked.assets[0]) return cancelRef.current();
      setPhase('cutting');
      try {
        const working = await workingPhoto(picked.assets[0]);
        const result = await automaticMask(working.uri);
        if (!current) return;
        setPhoto(working);
        if ('uri' in result) setMask(result.uri);
        else setNotice(result.reason);
      } catch (error) {
        reportarError('useStickerCutout.pick', error);
        if (current) setNotice('No se pudo leer la foto.');
      }
      if (current) setPhase('editing');
    })();
    return () => {
      current = false;
    };
  }, [visible]);

  // The image as it looks now: the mask (if on) and every stroke, cropped.
  useEffect(() => {
    if (!photo) return;
    let current = true;
    setBusy(true);
    refineCutout({ photo: photo.uri, mask: automatic ? mask : null, strokes })
      .then((result) => {
        if (!current) return;
        setShown(result);
        setNotice((before) => (before === NO_REFINE || before.startsWith('Borraste') ? '' : before));
      })
      .catch((error: { code?: string; message?: string }) => {
        if (!current) return;
        if (error.code !== 'ERR_EMPTY') reportarError('useStickerCutout.refine', error);
        setNotice(error.code === 'ERR_EMPTY' && error.message ? error.message : NO_REFINE);
        // Everything erased: nothing to show or send until a restore or undo.
        if (error.code === 'ERR_EMPTY') {
          setShown(null);
          setPreview(null);
        }
      })
      .finally(() => current && setBusy(false));
    return () => {
      current = false;
    };
  }, [photo, mask, automatic, strokes]);

  // The image with its outline (the same composition as the final sticker, without layers).
  useEffect(() => {
    if (!shown) return;
    let current = true;
    composeSticker({ image: shown.uri, outline, layers: [] })
      .then((result) => current && setPreview(result.uri))
      .catch(() => current && setPreview(shown.uri));
    return () => {
      current = false;
    };
  }, [shown, outline]);

  /** The automatic-background switch when there was no mask yet (the model was downloading). */
  const retryAutomatic = async () => {
    if (!photo || phase !== 'editing') return;
    setPhase('cutting');
    const result = await automaticMask(photo.uri);
    if ('uri' in result) {
      setMask(result.uri);
      setNotice('');
    } else setNotice(result.reason);
    setPhase('editing');
  };

  const view: CutoutView | null = shown ? { box: shown.box, geometry: stickerGeometry({ width: shown.width, height: shown.height, outline }), side: STICKER_COMPOSITION.side } : null;
  return { phase, setPhase, photo, mask, shown, preview, view, busy, notice, setNotice, retryAutomatic };
}
