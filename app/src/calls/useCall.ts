import { useCallback, useEffect, useRef, useState } from 'react';
import { CALL_TIMEOUT_MS, nextCallState, type CallState } from '@lilachat/shared';
import { getSocket } from '../chat/socketClient';

/**
 * La llamada, cableada al socket (F10).
 *
 * **El estado sale de la máquina de `shared/call.ts`** — acá solo se traducen
 * los eventos del socket a eventos de la máquina y se emite lo que hay que
 * emitir. Es lo que evita que la pantalla y el otro teléfono tengan ideas
 * distintas de lo que está pasando.
 *
 * **QUÉ FALTA, y hay que decirlo**: el audio y el video de verdad los mueve
 * `react-native-webrtc`, que es un módulo NATIVO y no está instalado todavía.
 * Esto arma y reparte la señalización —oferta, respuesta, candidatos— y la
 * pantalla; conectar el `RTCPeerConnection` es el paso siguiente, y una llamada
 * real necesita DOS dispositivos para probarse.
 */
export function useCall(params: { chatId: string; peerName: string }) {
  const [state, setState] = useState<CallState | null>(null);
  const [video, setVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aplicar = useCallback((evento: Parameters<typeof nextCallState>[1]) => {
    setState((actual) => (actual ? nextCallState(actual, evento) : actual));
  }, []);

  /** Corta sola si nadie contesta: «llamando…» eterno no le sirve a nadie. */
  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    if (!state || state.fase === 'activa' || state.fase === 'terminada') return;

    timeout.current = setTimeout(
      () => aplicar({ tipo: 'tiempo', at: Date.now() }),
      Math.max(0, state.desde + CALL_TIMEOUT_MS - Date.now())
    );
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [state, aplicar]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const entrante = (data: { chatId: string; video?: boolean }) => {
      if (data.chatId !== params.chatId) return;
      // Si YA hay una llamada, la nueva recibe «ocupado» en vez de pisar la que
      // está en curso.
      setState((actual) => {
        if (actual && actual.fase !== 'terminada') {
          socket.emit('call.reject', { chatId: data.chatId, motivo: 'ocupado' });
          return actual;
        }
        setVideo(Boolean(data.video));
        return { fase: 'sonando', desde: Date.now(), entrante: true };
      });
    };

    const contestada = (data: { chatId: string }) =>
      data.chatId === params.chatId && aplicar({ tipo: 'contestada', at: Date.now() });

    const terminada = (data: { chatId: string; motivo?: string }) =>
      data.chatId === params.chatId &&
      aplicar(
        data.motivo === 'ocupado'
          ? { tipo: 'ocupado', at: Date.now() }
          : { tipo: 'colgada', at: Date.now(), porMi: false }
      );

    socket.on('call.offer', entrante);
    socket.on('call.answer', contestada);
    socket.on('call.end', terminada);
    socket.on('call.reject', terminada);

    return () => {
      socket.off('call.offer', entrante);
      socket.off('call.answer', contestada);
      socket.off('call.end', terminada);
      socket.off('call.reject', terminada);
    };
  }, [params.chatId, aplicar]);

  const llamar = useCallback(
    (conVideo: boolean) => {
      setVideo(conVideo);
      setState({ fase: 'llamando', desde: Date.now(), entrante: false });
      getSocket()?.emit('call.offer', { chatId: params.chatId, video: conVideo });
    },
    [params.chatId]
  );

  const contestar = useCallback(() => {
    aplicar({ tipo: 'contestada', at: Date.now() });
    getSocket()?.emit('call.answer', { chatId: params.chatId });
  }, [params.chatId, aplicar]);

  const colgar = useCallback(() => {
    // Se avisa SIEMPRE, incluso rechazando: el otro tiene que dejar de sonar.
    getSocket()?.emit('call.end', { chatId: params.chatId, motivo: 'colgada' });
    setState((actual) =>
      actual
        ? nextCallState(
            actual,
            actual.fase === 'sonando'
              ? { tipo: 'rechazada', at: Date.now() }
              : { tipo: 'colgada', at: Date.now(), porMi: true }
          )
        : actual
    );
  }, [params.chatId]);

  return {
    state,
    video,
    muted,
    speaker,
    llamar,
    contestar,
    colgar,
    alternarMute: () => setMuted((valor) => !valor),
    alternarAltavoz: () => setSpeaker((valor) => !valor),
    alternarVideo: () => setVideo((valor) => !valor),
    cerrar: () => setState(null),
  };
}
