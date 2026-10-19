import { useEffect, useRef, useState } from 'react';
import { esVozUsable, ondaDesdeMuestras } from '@lilachat/shared';
import { nivelEnDb, tipoDeGrabacion } from './nivelDeAudio';

/** Cada cuánto se mide el nivel (ms): de ahí sale la onda, como en la app. */
const MEDIR_CADA_MS = 100;

export type NotaDeVozGrabada = { file: File; ms: number; onda: number[] };
export type EstadoDeGrabadora = { fase: 'quieta' } | { fase: 'grabando'; ms: number } | { fase: 'error'; motivo: string };

type Sesion = { grabador: MediaRecorder; flujo: MediaStream; contexto: AudioContext; medidor: ReturnType<typeof setInterval>; desde: number; trozos: Blob[]; muestras: number[] };

/**
 * Grabar una nota de voz en la web (W2) con `MediaRecorder`. El micrófono se
 * pide al tocar el botón, nunca al entrar. El nivel se mide con un
 * `AnalyserNode` y la onda sale del MISMO motor que la app (`ondaDesdeMuestras`).
 */
export function useGrabadoraDeVoz() {
  const [estado, setEstado] = useState<EstadoDeGrabadora>({ fase: 'quieta' });
  const sesion = useRef<Sesion | null>(null);

  const soltar = () => {
    const actual = sesion.current;
    sesion.current = null;
    if (!actual) return;
    clearInterval(actual.medidor);
    actual.flujo.getTracks().forEach((pista) => pista.stop());
    void actual.contexto.close().catch(() => undefined);
  };
  useEffect(() => soltar, []);

  const empezar = async () => {
    if (sesion.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return setEstado({ fase: 'error', motivo: 'Este navegador no puede grabar audio.' });
    }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = tipoDeGrabacion((uno) => MediaRecorder.isTypeSupported(uno));
      const grabador = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined);
      const contexto = new AudioContext();
      const analizador = contexto.createAnalyser();
      contexto.createMediaStreamSource(flujo).connect(analizador);
      const tramo = new Float32Array(analizador.fftSize);
      const nueva: Sesion = { grabador, flujo, contexto, desde: Date.now(), trozos: [], muestras: [], medidor: 0 as unknown as ReturnType<typeof setInterval> };
      grabador.ondataavailable = (evento) => {
        if (evento.data.size) nueva.trozos.push(evento.data);
      };
      nueva.medidor = setInterval(() => {
        analizador.getFloatTimeDomainData(tramo);
        nueva.muestras.push(nivelEnDb(tramo));
        setEstado({ fase: 'grabando', ms: Date.now() - nueva.desde });
      }, MEDIR_CADA_MS);
      sesion.current = nueva;
      grabador.start();
      setEstado({ fase: 'grabando', ms: 0 });
    } catch (error) {
      soltar();
      const sinPermiso = error instanceof DOMException && error.name === 'NotAllowedError';
      setEstado({ fase: 'error', motivo: sinPermiso ? 'Activa el micrófono para este sitio en el navegador.' : 'No se pudo grabar.' });
    }
  };

  /** Termina: con `cancelar` (o si quedó muy corta) se descarta y devuelve `null`. */
  const terminar = (cancelar = false): Promise<NotaDeVozGrabada | null> =>
    new Promise((listo) => {
      const actual = sesion.current;
      if (!actual) return listo(null);
      const ms = Date.now() - actual.desde;
      actual.grabador.onstop = () => {
        const tipo = actual.grabador.mimeType || 'audio/webm';
        const blob = new Blob(actual.trozos, { type: tipo.split(';')[0] });
        const extension = tipo.includes('mp4') ? 'm4a' : tipo.includes('ogg') ? 'ogg' : 'webm';
        soltar();
        setEstado({ fase: 'quieta' });
        if (cancelar || !esVozUsable(ms) || blob.size === 0) return listo(null);
        listo({ file: new File([blob], `nota-de-voz-${Date.now()}.${extension}`, { type: blob.type }), ms, onda: ondaDesdeMuestras(actual.muestras) });
      };
      actual.grabador.stop();
    });

  return { estado, empezar, terminar, limpiarError: () => setEstado({ fase: 'quieta' }) };
}
