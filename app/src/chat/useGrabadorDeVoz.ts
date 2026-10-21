import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  AudioModule,
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { esVozUsable, ondaDesdeMuestras } from '@lilachat/shared';
import { opcionesNativasDeGrabacion } from './opcionesDeGrabacion';
import { recordingAudioMode } from './audioMode';

/** Con la medición del nivel encendida: de ahí sale la onda (FL9). Fija: el hook la compara. */
const OPCIONES_DE_GRABACION = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
/** Cada cuánto se mide el nivel (ms): 10 por segundo dan una onda con forma. */
const MEDIR_CADA_MS = 100;

/**
 * El permiso del micrófono, recordado en el proceso (FL9): pedirlo en cada
 * nota costaba 220 ms aunque ya estuviera dado, y era lo que más demoraba el
 * arranque (medido en el emulador: permiso 221, modo 46, preparar 33).
 */
let permisoConcedido = false;

/** Consulta sin diálogo, para que hasta la primera nota arranque sin esa demora. */
export function precalentarPermisoDeVoz(): void {
  if (permisoConcedido) return;
  void getRecordingPermissionsAsync()
    .then((permiso) => {
      if (permiso.granted) permisoConcedido = true;
    })
    .catch(() => undefined);
}

/**
 * Grabar una nota de voz.
 *
 * **Un toque graba sin el dedo, y sostener también vale** (FL9, `gestoDeVoz`):
 * sostener y soltar manda, como WhatsApp. El toque se mantiene porque para
 * quien no tiene incorporado sostener, soltar sin querer mandaba audios
 * cortados a la mitad.
 *
 * El permiso se pide al primer intento, no al abrir la app: pedir el micrófono
 * antes de que alguien quiera grabar algo se lee como que la app escucha.
 */
export type EstadoDeGrabacion =
  | { fase: 'quieto' }
  | { fase: 'grabando'; ms: number }
  | { fase: 'sin-permiso' }
  | { fase: 'error'; motivo: string };

export type NotaGrabada = { uri: string; mime: string; ms: number; bytes: number; onda?: number[] };

export function useGrabadorDeVoz() {
  /**
   * El grabador nativo se crea recién al GRABAR (19/10). Con `useAudioRecorder`
   * nacía al montar la barra, y si el chat se montaba mientras Android
   * recreaba la actividad, el constructor fallaba y se caía la pantalla entera
   * («the current activity is no longer available»). Ahora ese fallo es un
   * «No se pudo grabar» y el chat sigue.
   */
  const grabadorRef = useRef<AudioRecorder | null>(null);
  const obtenerGrabador = (): AudioRecorder => {
    grabadorRef.current ??= new AudioModule.AudioRecorder(opcionesNativasDeGrabacion(OPCIONES_DE_GRABACION, Platform.OS));
    return grabadorRef.current;
  };
  useEffect(
    () => () => {
      grabadorRef.current?.release();
      grabadorRef.current = null;
    },
    []
  );
  const [estado, setEstado] = useState<EstadoDeGrabacion>({ fase: 'quieto' });
  const desde = useRef(0);
  // En un ref y no solo en el estado: quien suelta el micrófono llama a
  // `terminar` justo después de `empezar`, antes de que el estado nuevo llegue
  // a su render — con el estado viejo, la nota no se cortaba nunca.
  const grabando = useRef(false);
  /** El nivel medido cada 100 ms mientras se graba, en dB (FL9). */
  const muestras = useRef<number[]>([]);

  /**
   * El contador va por acá y no por el estado del módulo: se necesita que
   * avance en pantalla cada segundo, y `currentTime` solo cambia cuando alguien
   * lo lee.
   */
  useEffect(() => {
    if (estado.fase !== 'grabando') return;
    let segundoMostrado = -1;
    const t = setInterval(() => {
      const nivel = grabadorRef.current?.getStatus().metering;
      if (typeof nivel === 'number') muestras.current.push(nivel);
      // La barra se redibuja solo cuando cambia el segundo que muestra.
      const ms = Date.now() - desde.current;
      if (Math.floor(ms / 1000) === segundoMostrado) return;
      segundoMostrado = Math.floor(ms / 1000);
      setEstado((actual) => (actual.fase === 'grabando' ? { fase: 'grabando', ms } : actual));
    }, MEDIR_CADA_MS);
    return () => clearInterval(t);
  }, [estado.fase]);

  const empezar = async (): Promise<void> => {
    if (!permisoConcedido) {
      const permiso = await requestRecordingPermissionsAsync();
      if (!permiso.granted) {
        setEstado({ fase: 'sin-permiso' });
        return;
      }
      permisoConcedido = true;
    }
    try {
      // Sin esto Android graba en silencio: el modo por defecto no habilita la
      // captura y el archivo sale vacío.
      // And with the screen locked it keeps recording (20/10).
      await setAudioModeAsync(recordingAudioMode(true));
      const grabador = obtenerGrabador();
      await grabador.prepareToRecordAsync();
      muestras.current = [];
      grabador.record();
      desde.current = Date.now();
      grabando.current = true;
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
    if (!grabando.current) return null;
    grabando.current = false;
    const ms = Date.now() - desde.current;
    setEstado({ fase: 'quieto' });

    const grabador = grabadorRef.current;
    if (!grabador) return null;
    try {
      await grabador.stop();
      // Volver a dejar el audio como estaba: con `allowsRecording` puesto, en
      // Android el altavoz queda en modo llamada y el próximo audio se escucha
      // bajito y por el auricular.
      await setAudioModeAsync(recordingAudioMode(false));
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
    return { uri, mime: 'audio/m4a', ms, bytes, onda: ondaDesdeMuestras(muestras.current) };
  };

  return { estado, empezar, terminar, limpiarAviso: () => setEstado({ fase: 'quieto' }) };
}
