import { Directory, File, Paths } from 'expo-file-system';
import { sha256 } from 'js-sha256';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { decideInstall, installMessage, type InstallVerdict } from './installDecision';

/**
 * Bajar el APK de la actualización, **verificarlo** y entregárselo al instalador
 * de Android — para actualizar Lilachat DESDE Lilachat, sin abrir LilaStore.
 *
 * Portado del mismo mecanismo con que la tienda se actualiza a sí misma
 * (`lilastore-app/src/data/apkInstall.ts`). La diferencia: Lilachat es una app
 * **pública**, así que su APK se baja del `downloadUrl` que da `min-version` SIN
 * credencial (a diferencia de `/d/:release` de la tienda, que la exige).
 *
 * Las tres reglas que no se negocian:
 * 1. **El `sha256` se comprueba ANTES de invocar al instalador.** Una vez que
 *    Android abre el diálogo, la app ya no manda.
 * 2. **Ninguna instalación es silenciosa.** Se entrega al `PackageInstaller` y la
 *    persona toca «Instalar»; evitarlo exige ser *device owner* (fábrica).
 * 3. **Un archivo que no verifica se BORRA.** Dejarlo es dejar un APK alterado al
 *    alcance de otra app con permiso de archivos.
 */

/** Carpeta propia dentro del cache: la limpia el sistema si hace falta espacio. */
const CARPETA = 'apks';

export type DownloadOutcome =
  | { ok: true; uri: string }
  | { ok: false; message: string; verdict?: InstallVerdict };

export async function downloadAndVerify(opciones: {
  /** URL pública de la release vigente (la `downloadUrl` de `min-version`). */
  url: string;
  /** Para nombrar el archivo en el cache: dos versiones no se pisan. */
  releaseId: string;
  expectedSha256: string;
  expectedSize: number;
  onProgress: (recibido: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<DownloadOutcome> {
  const carpeta = new Directory(Paths.cache, CARPETA);
  if (!carpeta.exists) carpeta.create({ intermediates: true });

  const destino = new File(carpeta, `${opciones.releaseId}.apk`);

  let archivo: File;
  try {
    archivo = await File.downloadFileAsync(opciones.url, destino, {
      // Sobrescribir y no fallar: un intento anterior cortado dejó un archivo, y
      // hacerlo fallar dejaría a la persona sin poder reintentar.
      idempotent: true,
      onProgress: ({ bytesWritten, totalBytes }) => {
        opciones.onProgress(bytesWritten, totalBytes);
      },
      signal: opciones.signal,
    });
  } catch (fallo) {
    borrar(destino);
    const abortada = fallo instanceof Error && fallo.name === 'AbortError';
    return {
      ok: false,
      message: abortada ? 'Descarga cancelada.' : 'No se pudo descargar. Revisá la señal.',
    };
  }

  const veredicto = decideInstall({
    expected: opciones.expectedSha256,
    actual: await sha256Of(archivo),
    expectedSize: opciones.expectedSize,
    actualSize: archivo.size ?? undefined,
  });

  if (!veredicto.install) {
    borrar(archivo);
    return {
      ok: false,
      message: installMessage(veredicto) ?? 'El archivo no se pudo verificar.',
      verdict: veredicto,
    };
  }

  return { ok: true, uri: archivo.uri };
}

/**
 * El `sha256` del archivo, leyéndolo como **stream**.
 *
 * `arrayBuffer()` de Expo corrompe archivos grandes (el hash sale distinto);
 * `readableStream()` entrega `Uint8Array` de verdad y `js-sha256` acepta
 * `update()`, así que el archivo nunca está entero en memoria. Devuelve `null`
 * si no se pudo leer, y `decideInstall` con `null` **no instala**: falla cerrado.
 */
async function sha256Of(archivo: File): Promise<string | null> {
  try {
    const hasher = sha256.create();
    const lector = archivo.readableStream().getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (value) hasher.update(value);
    }
    return hasher.hex();
  } catch {
    return null;
  }
}

/**
 * Se lo pasa al instalador del sistema.
 *
 * Va por `content://` y no por `file://`: desde Android 7 pasar un `file://`
 * entre apps lanza `FileUriExposedException`. El `FileProvider` lo aporta
 * `expo-file-system`.
 */
export async function handToInstaller(uri: string): Promise<boolean> {
  const contentUri = await getContentUriAsync(uri);
  const resultado = await IntentLauncher.startActivityAsync(
    'android.intent.action.INSTALL_PACKAGE',
    {
      data: contentUri,
      // FLAG_GRANT_READ_URI_PERMISSION: sin esto el instalador recibe una URI que
      // no puede leer y falla con «No se pudo analizar el paquete».
      flags: 1,
      extra: { 'android.intent.extra.RETURN_RESULT': true },
    }
  );
  return resultado.resultCode === IntentLauncher.ResultCode.Success;
}

function borrar(archivo: File): void {
  try {
    if (archivo.exists) archivo.delete();
  } catch {
    // Que no se pueda borrar no cambia la decisión: igual no se instala.
  }
}
