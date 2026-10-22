import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { downloadAndVerify, handToInstaller } from './apkInstall';
import { downloadFailedText, afterCutDownload } from './updateRetry';
import { hayConQueActualizar, type InfoActualizacion } from './actualizacionInfo';

export { hayConQueActualizar, type InfoActualizacion } from './actualizacionInfo';

/**
 * Actualizar Lilachat DESDE Lilachat: baja el APK con progreso, **verifica el
 * sha256** y se lo entrega al instalador de Android. Sin abrir LilaStore.
 *
 * El estado maneja lo que la banda muestra. Nunca lanza: un fallo de descarga o
 * de verificación deja `error` con motivo, no rompe la pantalla.
 */
export type EstadoActualizacion =
  | { fase: 'idle' }
  | { fase: 'descargando'; progreso: number }
  | { fase: 'instalando' }
  | { fase: 'error'; mensaje: string };

/** The screen stays on while the APK downloads (22/10): locked, Android cut the download. */
const KEEP_AWAKE_TAG = 'lilachat-update';

export function useActualizador() {
  const [estado, setEstado] = useState<EstadoActualizacion>({ fase: 'idle' });
  /** A download the background cut: it goes on alone, once, when the app comes back (`updateRetry.ts`). */
  const cutDownload = useRef<InfoActualizacion | null>(null);
  const resumed = useRef(false);
  const resumeCut = useRef<() => void>(() => undefined);

  const actualizar = useCallback(async (info: InfoActualizacion): Promise<void> => {
    if (!hayConQueActualizar(info)) {
      setEstado({
        fase: 'error',
        mensaje: 'No se pudo preparar la actualización. Prueba desde LilaStore.',
      });
      return;
    }

    setEstado({ fase: 'descargando', progreso: 0 });
    let leftTheApp = false;
    const watching = AppState.addEventListener('change', (next) => {
      if (next !== 'active') leftTheApp = true;
    });
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    const resultado = await downloadAndVerify({
      url: info.downloadUrl,
      releaseId: info.releaseId,
      expectedSha256: info.sha256,
      expectedSize: info.size,
      onProgress: (recibido, total) =>
        setEstado({ fase: 'descargando', progreso: total > 0 ? recibido / total : 0 }),
    });
    watching.remove();
    void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);

    if (!resultado.ok) {
      // A cut download says what to do; the technical reason already went to the diagnostics.
      const next = afterCutDownload({ cut: Boolean(resultado.cut), leftTheApp, activeNow: AppState.currentState === 'active', alreadyResumed: resumed.current });
      cutDownload.current = next === 'none' ? null : info;
      if (next === 'resume-now') return resumeCut.current();
      setEstado({ fase: 'error', mensaje: resultado.cut ? downloadFailedText(next === 'resume-on-return') : resultado.message });
      return;
    }

    setEstado({ fase: 'instalando' });
    try {
      await handToInstaller(resultado.uri);
    } catch {
      // Que no se abra el instalador es raro pero posible: se avisa, no se cuelga.
      setEstado({ fase: 'error', mensaje: 'No se pudo abrir el instalador.' });
      return;
    }
    // Si instaló, la app se reemplaza y este estado no se ve; si canceló, vuelve
    // a la banda para reintentar.
    setEstado({ fase: 'idle' });
  }, []);

  const limpiar = useCallback(() => setEstado({ fase: 'idle' }), []);

  resumeCut.current = () => {
    const info = cutDownload.current;
    if (!info) return;
    resumed.current = true;
    cutDownload.current = null;
    void actualizar(info);
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') resumeCut.current();
    });
    return () => subscription.remove();
  }, []);

  /** Tapping «Actualizar» or «Reintentar» earns a new automatic resume. */
  const updateByHand = useCallback((info: InfoActualizacion) => {
    resumed.current = false;
    return actualizar(info);
  }, [actualizar]);

  return { estado, actualizar: updateByHand, limpiar };
}
