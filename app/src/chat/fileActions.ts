import { Alert, Linking } from 'react-native';
import { downloadUrlOf } from '@lilachat/shared';
import { nombreLimpio } from './archivoDescargado';
import { abrirConOtraApp } from './guardarYCompartir';

/** A file of a message: where it lives, when it came, its type and its own name. */
export type ChatFile = { url: string; cuando: Date; mime?: string; seq: number; nombre?: string };

/**
 * «Descargar» hands the link to the phone's own downloader (the browser), which keeps the file in Downloads with
 * its notice. Android does not let an app write straight into Downloads (E2E 17/11: «Can't use this folder»).
 */
async function download(file: ChatFile, onError: (reason: string) => void): Promise<void> {
  const opened = await Linking.openURL(downloadUrlOf(file.url, file.nombre)).then(() => true, () => false);
  if (!opened) onError('No pudimos abrir la descarga. Prueba «Abrir».');
}

/**
 * A file's two ways out (José 17/11: «no podemos descargar el archivo»): open it with an app of the phone, or
 * download it with its own name. Errors go to the chat's line.
 */
export function offerFileActions(file: ChatFile, onError: (reason: string) => void): void {
  Alert.alert(file.nombre ? nombreLimpio(file.nombre) : 'Archivo', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Abrir', onPress: () => void abrirConOtraApp(file).then((done) => (done.ok ? undefined : onError(done.motivo))) },
    { text: 'Descargar', onPress: () => void download(file, onError) },
  ]);
}
