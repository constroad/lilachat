import { useCallback, useState } from 'react';
import { downloadAndVerify, handToInstaller } from './apkInstall';
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

export function useActualizador() {
  const [estado, setEstado] = useState<EstadoActualizacion>({ fase: 'idle' });

  const actualizar = useCallback(async (info: InfoActualizacion): Promise<void> => {
    if (!hayConQueActualizar(info)) {
      setEstado({
        fase: 'error',
        mensaje: 'No se pudo preparar la actualización. Probá desde LilaStore.',
      });
      return;
    }

    setEstado({ fase: 'descargando', progreso: 0 });
    const resultado = await downloadAndVerify({
      url: info.downloadUrl,
      releaseId: info.releaseId,
      expectedSha256: info.sha256,
      expectedSize: info.size,
      onProgress: (recibido, total) =>
        setEstado({ fase: 'descargando', progreso: total > 0 ? recibido / total : 0 }),
    });

    if (!resultado.ok) {
      setEstado({ fase: 'error', mensaje: resultado.message });
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

  return { estado, actualizar, limpiar };
}
