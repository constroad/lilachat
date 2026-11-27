import { useState } from 'react';
import { stickerOptionsOf, VIDEO_STICKER_MAX_MS, type LibrarySticker } from '@lilachat/shared';
import type { ApiResult } from '../../api';
import { FieldError, Overlay, PrimaryButton } from '../../ui/Overlay';
import { CHECKERBOARD } from './CreateStickerFromVideo';
import { StickerSoundPicker } from './StickerSoundPicker';
import { initialSavedSoundPick, savedSoundRequestOf, type SoundPick, type SoundRequest } from './videoSticker';

type Props = {
  sticker: LibrarySticker;
  onSave: (sticker: LibrarySticker, request: SoundRequest) => Promise<ApiResult<{ sticker: LibrarySticker }>>;
  onClose: () => void;
};

/**
 * «Agregar sonido» / «Cambiar sonido» of a saved sticker (José 27/11: «quiero agregarle audio sin volver a buscar el
 * GIF», designs sa-01…sa-03): the sticker as it is, and the same sound choices as when it is made, except the video's.
 */
export function StickerSoundDialog({ sticker, onSave, onClose }: Props) {
  const options = stickerOptionsOf(sticker);
  const [pick, setPick] = useState<SoundPick | null>(() => initialSavedSoundPick(sticker));
  const [voice, setVoice] = useState<Blob | null>(null);
  const [upload, setUpload] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const request = savedSoundRequestOf(pick, voice, upload);
    if ('problem' in request) return setNotice(request.problem);
    setBusy(true);
    const saved = await onSave(sticker, request);
    setBusy(false);
    if (saved.ok) onClose();
    else setNotice(saved.message);
  };
  return (
    <Overlay title={options.sound} onClose={onClose} footer={<><FieldError>{notice}</FieldError><PrimaryButton testId="guardar-sonido-sticker" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar sonido'}</PrimaryButton></>}>
      <div className="flex flex-col items-center gap-2 pb-4">
        <div className={`grid h-40 w-40 place-items-center rounded-2xl border border-outline/15 ${CHECKERBOARD}`}>
          <img src={sticker.url} alt="" className="h-36 w-36 object-contain" />
        </div>
        <p data-testid="linea-sonido-sticker" className="text-[13px] text-on-surface-variant">{options.soundLine}</p>
      </div>
      <StickerSoundPicker pick={pick} hasOwnSound={false} clipMs={VIDEO_STICKER_MAX_MS} voice={voice} upload={upload} disabled={busy} onPick={(next) => { setPick(next); setNotice(''); }} onVoice={setVoice} onUpload={setUpload} onNotice={setNotice} />
    </Overlay>
  );
}
