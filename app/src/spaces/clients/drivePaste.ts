import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { pastedDriveName } from '@lilachat/shared';

export type PastedImage = { uri: string; name: string; mime: 'image/png'; width: number; height: number };

/**
 * «Pegar del portapapeles» in the service's Drive (José 19/11, design cc-05): Android's clipboard
 * carries an image, not a file. It is written to the cache as PNG and goes up like a gallery photo.
 * `null` when there is no image copied.
 */
export async function clipboardImage(now = new Date()): Promise<PastedImage | null> {
  if (!(await Clipboard.hasImageAsync())) return null;
  const image = await Clipboard.getImageAsync({ format: 'png' });
  if (!image?.data) return null;
  const name = pastedDriveName('', 'image/png', now);
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, image.data.replace(/^data:image\/\w+;base64,/, ''), { encoding: FileSystem.EncodingType.Base64 });
  return { uri, name, mime: 'image/png', width: image.size.width, height: image.size.height };
}

/** «Copiar enlace» of a Drive file. */
export const copyFileLink = (url: string): Promise<boolean> => Clipboard.setStringAsync(url);

/** «Copiar archivo» of a Drive photo: downloaded to the cache, then put on the clipboard as an image. */
export async function copyImageFile(url: string, name: string): Promise<void> {
  const local = `${FileSystem.cacheDirectory}copia-${Date.now()}-${name.replace(/[^\w.-]/g, '_')}`;
  const saved = await FileSystem.downloadAsync(url, local);
  const base64 = await FileSystem.readAsStringAsync(saved.uri, { encoding: FileSystem.EncodingType.Base64 });
  await Clipboard.setImageAsync(base64);
}
