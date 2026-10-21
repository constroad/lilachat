import { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { pastedImageName, shouldOfferPaste } from './clipboardImage';
import type { FotoElegida } from './envioDeFotos';
import { reportarError } from '../ui/reportarError';

/**
 * Whether the bar offers «Pegar la imagen copiada», and the paste itself. Only
 * `hasImageAsync` runs on its own (it reads the description, without Android's
 * «pasted from your clipboard» notice); the image is read when the person taps.
 * Dismissing it lasts until something new is copied.
 */
export function useClipboardImage(focused: boolean, photosAllowed: boolean) {
  const [hasImage, setHasImage] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!focused || !photosAllowed) return;
    let current = true;
    void Clipboard.hasImageAsync().then((value) => current && setHasImage(value), () => current && setHasImage(false));
    return () => {
      current = false;
    };
  }, [focused, photosAllowed]);

  useEffect(() => {
    const subscription = Clipboard.addClipboardListener((event) => {
      setDismissed(false);
      setHasImage(event.contentTypes.includes(Clipboard.ContentType.IMAGE));
    });
    return () => subscription.remove();
  }, []);

  const paste = useCallback(async (): Promise<FotoElegida | null> => {
    try {
      const image = await Clipboard.getImageAsync({ format: 'png' });
      if (!image?.data) return null;
      const base64 = image.data.replace(/^data:image\/\w+;base64,/, '');
      const fileName = pastedImageName(new Date());
      const uri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      setDismissed(true);
      return { uri, fileName, mimeType: 'image/png', width: image.size.width, height: image.size.height };
    } catch (error) {
      reportarError('useClipboardImage.paste', error);
      return null;
    }
  }, []);

  return { offer: shouldOfferPaste({ focused, hasImage, dismissed, photosAllowed }), paste, dismiss: () => setDismissed(true) };
}
