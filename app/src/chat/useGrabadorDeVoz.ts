import { useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { esVozUsable } from '@lilachat/shared';

/**
 * Grabar una nota de voz.
 *
 * **Se toca para empezar y se toca para mandar**, no se mantiene apretado. En
 * WhatsApp hay que sostener el dedo, y para quien no lo tiene incorporado eso
 * termina en audios cortados a la mitad: soltás sin querer y ya se mandó. Con
 * dos toques se puede hablar tranquilo, mirar la pantalla, y cancelar.
 *
 * El permiso se pide al primer intento, no al abrir la app: pedir el micrófono
 * antes de que alguien quiera grabar algo se lee como que la app escucha.
 */
export type EstadoDeGrabacion =
  | { fase: 'quieto' }
  | { fase: 'grabando'; ms: number }
  | { fase: 'sin-permiso' }
  | { fase: 'error'; motivo: string };

export type NotaGrabada = { uri: string; mime: string; ms: number; bytes: number };

export function useGrabadorDeVoz() {
  const grabador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [estado, setEstado] = useState<EstadoDeGrabacion>({ fase: 'quieto' });
  const desde = useRef(0);

  /**
   * El contador va por acá y no por el estado del módulo: se necesita que
   * avance en pantalla cada segundo, y `currentTime` solo cambia cuando alguien
   * lo lee.
   */
  useEffect(() => {
    if (estado.fase !== 'grabando') return;
    const t = setInterval(() => {
      setEstado((actual) =>
        actual.fase === 'grabando' ? { fase: 'grabando', ms: Date.now() - desde.current } : actual
      );
    }, 250);
    return () => clearInterval(t);
  }, [estado.fase]);

  const empezar = async (): Promise<void> => {
    const permiso = await requestRecordingPermissionsAsync();
    if (!permiso.granted) {
      setEstado({ fase: 'sin-permiso' });
      return;
    }
    try {
      // Sin esto Android graba en silencio: el modo por defecto no habilita la
      // captura y el archivo sale vacío.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await grabador.prepareToRecordAsync();
      grabador.record();
      desde.current = Date.now();
      setEstado({ fase: 'grabando', ms: 0 });
    } catch (error) {
      setEstado({ fase: 'error', motivo: error instanceof Error ? error.message : 'No se pudo grabar.' });
    }
  };

  /**
   * Termina y devuelve la nota, o `null` si no hay nada que mandar.
   *
   * `cancelar` y «se soltó sin querer» terminan en el mismo lugar a propósito:
   * en los dos casos el archivo se descarta y la conversación queda como estaba.
   */
  const terminar = async (params: { cancelar?: boolean } = {}): Promise<NotaGrabada | null> => {
    if (estado.fase !== 'grabando') return null;
    const ms = Date.now() - desde.current;
    setEstado({ fase: 'quieto' });

    try {
      await grabador.stop();
      // Volver a dejar el audio como estaba: con `allowsRecording` puesto, en
      // Android el altavoz queda en modo llamada y el próximo audio se escucha
      // bajito y por el auricular.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      return null;
    }

    const uri = grabador.uri;
    if (params.cancelar || !uri || !esVozUsable(ms)) return null;

    // El TAMAÑO hace falta antes de subir: la validación compartida rechaza un
    // archivo de 0 bytes, que es justo lo que devuelve una grabación fallida.
    const info = await FileSystem.getInfoAsync(uri);
    const bytes = info.exists && !info.isDirectory ? info.size : 0;
    if (!bytes) return null;

    // `.m4a` en Android y en iOS con este preset: el mime va explícito porque el
    // server decide por él si es una nota de voz o un archivo cualquiera.
    return { uri, mime: 'audio/m4a', ms, bytes };
  };

  return { estado, empezar, terminar, limpiarAviso: () => setEstado({ fase: 'quieto' }) };
}
