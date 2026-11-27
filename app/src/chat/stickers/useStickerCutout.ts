import { createContext, useEffect, useState } from 'react';
import { STICKER_COMPOSITION, stickerGeometry, type CutoutView, type MaskStroke } from '@lilachat/shared';
import { composeSticker, refineCutout, subjectCutout, type RefinedCutout, type WorkingPhoto } from '../../../modules/subject-cutout/src';
import { reportarError } from '../../ui/reportarError';
import type { PickedPhoto } from './pickStickerSource';

export type CutoutPhase = 'cutting' | 'editing' | 'saving';

/** The photo «Crear» picked (José 26/11): the panel hands it to the editor, which no longer opens the gallery. */
export const StickerPhotoContext = createContext<PickedPhoto | null>(null);
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
async function workingPhoto(asset: PickedPhoto): Promise<WorkingPhoto> {
  if (!subjectCutout) return { uri: asset.uri, width: asset.width, height: asset.height };
  return subjectCutout.preparePhoto(asset.uri);
}

type PreparedCutout = { working: WorkingPhoto | null; mask: string | null; notice: string };

/** The working copy of the picked photo and ML Kit's mask; what went wrong as a notice. Never throws. */
async function prepareCutout(picked: PickedPhoto): Promise<PreparedCutout> {
  try {
    const working = await workingPhoto(picked);
    const result = await automaticMask(working.uri);
    return 'uri' in result ? { working, mask: result.uri, notice: '' } : { working, mask: null, notice: result.reason };
  } catch (error) {
    reportarError('useStickerCutout.pick', error);
    return { working: null, mask: null, notice: 'No se pudo leer la foto.' };
  }
}

/** The image with its outline (the same composition as the final sticker, without layers); null without an image. */
function useOutlinedPreview(shown: RefinedCutout | null, outline: boolean): string | null {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!shown) return setPreview(null);
    let current = true;
    composeSticker({ image: shown.uri, outline, layers: [] })
      .then((result) => current && setPreview(result.uri))
      .catch(() => current && setPreview(shown.uri));
    return () => {
      current = false;
    };
  }, [shown, outline]);
  return preview;
}

/**
 * The cutout of «Crear sticker» (José, 20/10): the photo picked by «Crear»
 * (José 26/11: the gallery opens once, before the editor), its working copy,
 * ML Kit's mask, and the image redone after each erase/restore stroke or undo.
 * `view` says where that image sits in the sticker, for the brushes.
 */
export function useStickerCutout(params: { visible: boolean; picked: PickedPhoto | null; automatic: boolean; strokes: MaskStroke[]; outline: boolean }) {
  const { visible, picked, automatic, strokes, outline } = params;
  const [phase, setPhase] = useState<CutoutPhase>('cutting');
  const [photo, setPhoto] = useState<WorkingPhoto | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [shown, setShown] = useState<RefinedCutout | null>(null);
  const preview = useOutlinedPreview(shown, outline);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!visible || !picked) return;
    let current = true;
    setPhase('cutting');
    setPhoto(null);
    setShown(null);
    void prepareCutout(picked).then((prepared) => {
      if (!current) return;
      setPhoto(prepared.working);
      setMask(prepared.mask);
      setNotice(prepared.notice);
      setPhase('editing');
    });
    return () => {
      current = false;
    };
  }, [visible, picked]);

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
        // Everything erased: nothing to show or send until a restore or undo (the preview follows).
        if (error.code === 'ERR_EMPTY') setShown(null);
      })
      .finally(() => current && setBusy(false));
    return () => {
      current = false;
    };
  }, [photo, mask, automatic, strokes]);

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
