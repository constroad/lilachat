import { useState, type ReactNode } from 'react';
import { ToastAndroid } from 'react-native';
import type { LibrarySticker } from '@lilachat/shared';
import { SavedStickerSoundSheet } from './SavedStickerSoundSheet';
import { StickerExportSheet } from './StickerExportSheet';
import { StickerOptionsSheet } from './StickerOptionsSheet';
import type { StickersState } from './useStickers';

const NO_SOUND = { audio: null, fields: [['sound', 'none']] as [string, string][] };

/**
 * The sheets of a saved sticker on the APK (José 27/11, designs sa-01, sa-02, sa-05): its options on a long press,
 * then its sound or its export. The panel only calls `onOptions`; the host draws `sheets`.
 */
export function useSavedStickerSheets(jwt: string, stickers: StickersState): { onOptions: (sticker: LibrarySticker) => void; sheets: ReactNode } {
  const [optionsFor, setOptionsFor] = useState<LibrarySticker | null>(null);
  const [soundFor, setSoundFor] = useState<LibrarySticker | null>(null);
  const [exportFor, setExportFor] = useState<LibrarySticker | null>(null);
  const removeSound = async (sticker: LibrarySticker) => {
    const done = await stickers.setSound(sticker, NO_SOUND);
    ToastAndroid.show(done.ok ? 'El sticker quedó sin sonido' : done.reason, ToastAndroid.SHORT);
  };
  const sheets = (
    <>
      <StickerOptionsSheet
        sticker={optionsFor}
        onClose={() => setOptionsFor(null)}
        actions={{ onSound: setSoundFor, onRemoveSound: (sticker) => void removeSound(sticker), onExport: setExportFor, onToggleFavorite: (sticker) => void stickers.toggleFavorite(sticker), onRemove: (sticker) => void stickers.remove(sticker) }}
      />
      {soundFor ? <SavedStickerSoundSheet key={soundFor.id} sticker={soundFor} onSave={stickers.setSound} onClose={() => setSoundFor(null)} /> : null}
      <StickerExportSheet jwt={jwt} sticker={exportFor} onClose={() => setExportFor(null)} />
    </>
  );
  return { onOptions: setOptionsFor, sheets };
}
