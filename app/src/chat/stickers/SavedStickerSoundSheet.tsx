import { useState } from 'react';
import { ToastAndroid } from 'react-native';
import { stickerSoundLabelOf, type LibrarySticker } from '@lilachat/shared';
import type { ApiOutcome, SavedSoundUpload } from './stickersApi';
import { StickerSoundSheet } from './StickerSoundSheet';
import type { StickerVoiceDoor } from './stickerVoiceDoor';
import { initialSavedChoice, savedSoundUploadOf } from './savedStickerSound';
import type { SoundChoice } from './videoStickerSound';

const SIX_SECONDS = '0:06';

/**
 * «Agregar sonido» / «Cambiar sonido» of a saved sticker on the APK (José 27/11, designs sa-01/sa-02): the same sound
 * sheet as when it is made, without «Sonido original» (a saved sticker has no video). «Guardar sonido» saves what
 * changed; the backdrop or back only close. Mounted with a `key` per sticker, so each opening starts on its own sound.
 */
export function SavedStickerSoundSheet(props: { sticker: LibrarySticker; onSave: (sticker: LibrarySticker, upload: SavedSoundUpload) => Promise<ApiOutcome<LibrarySticker>>; onClose: () => void; voiceDoor?: StickerVoiceDoor | null }) {
  const { sticker } = props;
  const [initial] = useState(() => initialSavedChoice(sticker));
  const [choice, setChoice] = useState<SoundChoice | null>(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    const upload = savedSoundUploadOf(initial, choice);
    if (!upload) return props.onClose();
    setSaving(true);
    const saved = await props.onSave(sticker, upload);
    setSaving(false);
    ToastAndroid.show(saved.ok ? 'Sonido guardado en el sticker' : saved.reason, ToastAndroid.SHORT);
    if (saved.ok) props.onClose();
  };
  const current = stickerSoundLabelOf(sticker);
  return (
    <StickerSoundSheet
      visible
      offerOriginal={false}
      choice={choice}
      clipLength={SIX_SECONDS}
      onChoose={setChoice}
      onPreviewOriginal={() => undefined}
      onClose={props.onClose}
      onDone={() => void save()}
      doneLabel={saving ? 'Guardando…' : 'Guardar sonido'}
      current={current ? `Ahora: ${current}` : undefined}
      voiceDoor={props.voiceDoor}
    />
  );
}
