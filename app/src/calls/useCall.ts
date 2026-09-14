import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';
import type RTCIceCandidateEvent from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent';
import { CALL_TIMEOUT_MS, nextCallState, type CallState } from '@lilachat/shared';
import { getSocket } from '../chat/socketClient';
import { obtenerIceServers, type ServidorIce } from './iceServers';
import { reportarError } from '../ui/reportarError';

/** El SDP y los candidatos viajan como objetos planos por el socket. */
type Sdp = { type: 'offer' | 'answer'; sdp: string };
type Candidato = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };

/**
 * La llamada, con audio/video REAL sobre `react-native-webrtc` (F10).
 *
 * **El estado de la UI sigue saliendo de la máquina de `shared/call.ts`** — acá
 * se le suma la capa de medios: `RTCPeerConnection`, la oferta/respuesta (SDP) y
 * los candidatos (ICE) que se reparten por la MISMA señalización del socket que
 * ya existía. El server es solo el cartero; el audio va directo entre los dos.
 *
 * ICE en buffer: un candidato que llega ANTES de fijar la descripción remota se
 * guarda y se aplica al fijarla, o `addIceCandidate` lo rechaza y se pierde media
 * llamada. TURN todavía no: hito 1 es misma red con STUN público (`iceServers`).
 */
async function pedirPermisos(conVideo: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const permisos = conVideo
    ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA]
    : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  const resultado = await PermissionsAndroid.requestMultiple(permisos);
  return permisos.every((permiso) => resultado[permiso] === PermissionsAndroid.RESULTS.GRANTED);
}

export function useCall(params: { chatId: string; peerName: string; jwt: string }) {
  const [state, setState] = useState<CallState | null>(null);
  const [video, setVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const stateRef = useRef<CallState | null>(null);
  /** Candidatos llegados antes de fijar la descripción remota. */
  const buffer = useRef<Candidato[]>([]);
  const remotoListo = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const aplicar = useCallback((evento: Parameters<typeof nextCallState>[1]) => {
    setState((actual) => (actual ? nextCallState(actual, evento) : actual));
  }, []);

  /** Cierra el peer, corta el micrófono/cámara y limpia lo pendiente. Idempotente. */
  const limpiar = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (error) {
        reportarError('call.close', error);
      }
      pcRef.current = null;
    }
    if (localRef.current) {
      localRef.current.getTracks().forEach((track) => track.stop());
      localRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    buffer.current = [];
    remotoListo.current = false;
  }, []);

  const crearPc = useCallback((iceServers: ServidorIce[]): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (evento: RTCIceCandidateEvent<'icecandidate'>) => {
      const candidato = evento.candidate;
      if (candidato) {
        // Objeto plano, no la instancia: socket.io serializa solo lo enumerable.
        getSocket()?.emit('call.ice', {
          chatId: params.chatId,
          candidate: {
            candidate: candidato.candidate,
            sdpMid: candidato.sdpMid,
            sdpMLineIndex: candidato.sdpMLineIndex,
          },
        });
      }
    };
    pc.ontrack = (evento: RTCTrackEvent<'track'>) => {
      const stream = evento.streams[0];
      if (stream) setRemoteStream(stream);
    };
    pcRef.current = pc;
    return pc;
  }, [params.chatId]);

  const agregarMedios = useCallback(
    async (pc: RTCPeerConnection, conVideo: boolean): Promise<void> => {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: conVideo });
      localRef.current = stream;
      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    },
    []
  );

  /** Marca la descripción remota como lista y aplica lo que estaba en cola. */
  const drenarCandidatos = useCallback(async (pc: RTCPeerConnection): Promise<void> => {
    remotoListo.current = true;
    for (const candidato of buffer.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidato));
      } catch (error) {
        reportarError('call.ice.buffer', error);
      }
    }
    buffer.current = [];
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

  /** Al terminar (colgar, rechazo, tiempo) se sueltan micrófono y peer. */
  useEffect(() => {
    if (state?.fase === 'terminada') limpiar();
  }, [state?.fase, limpiar]);

  useEffect(() => () => limpiar(), [limpiar]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const entrante = async (data: { chatId: string; video?: boolean; sdp?: Sdp }) => {
      if (data.chatId !== params.chatId) return;
      const actual = stateRef.current;
      // Si YA hay una llamada, la nueva recibe «ocupado» sin pisar la que está.
      if (actual && actual.fase !== 'terminada') {
        socket.emit('call.reject', { chatId: data.chatId, motivo: 'ocupado' });
        return;
      }
      setVideo(Boolean(data.video));
      setState({ fase: 'sonando', desde: Date.now(), entrante: true });
      try {
        const pc = crearPc(await obtenerIceServers(params.jwt));
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await drenarCandidatos(pc);
        }
      } catch (error) {
        reportarError('call.entrante', error);
      }
    };

    const contestada = async (data: { chatId: string; sdp?: Sdp }) => {
      if (data.chatId !== params.chatId) return;
      const pc = pcRef.current;
      if (pc && data.sdp) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await drenarCandidatos(pc);
        } catch (error) {
          reportarError('call.answer', error);
        }
      }
      aplicar({ tipo: 'contestada', at: Date.now() });
    };

    const hielo = async (data: { chatId: string; candidate?: Candidato }) => {
      if (data.chatId !== params.chatId || !data.candidate) return;
      const pc = pcRef.current;
      if (pc && remotoListo.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          reportarError('call.ice', error);
        }
      } else {
        buffer.current.push(data.candidate);
      }
    };

    const terminada = (data: { chatId: string; motivo?: string }) => {
      if (data.chatId !== params.chatId) return;
      aplicar(
        data.motivo === 'ocupado'
          ? { tipo: 'ocupado', at: Date.now() }
          : { tipo: 'colgada', at: Date.now(), porMi: false }
      );
    };

    socket.on('call.offer', entrante);
    socket.on('call.answer', contestada);
    socket.on('call.ice', hielo);
    socket.on('call.end', terminada);
    socket.on('call.reject', terminada);

    return () => {
      socket.off('call.offer', entrante);
      socket.off('call.answer', contestada);
      socket.off('call.ice', hielo);
      socket.off('call.end', terminada);
      socket.off('call.reject', terminada);
    };
  }, [params.chatId, params.jwt, aplicar, crearPc, drenarCandidatos]);

  const llamar = useCallback(
    async (conVideo: boolean) => {
      if (!(await pedirPermisos(conVideo))) return;
      setVideo(conVideo);
      setState({ fase: 'llamando', desde: Date.now(), entrante: false });
      try {
        const pc = crearPc(await obtenerIceServers(params.jwt));
        await agregarMedios(pc, conVideo);
        const oferta = await pc.createOffer({});
        await pc.setLocalDescription(oferta);
        getSocket()?.emit('call.offer', {
          chatId: params.chatId,
          video: conVideo,
          sdp: { type: 'offer', sdp: oferta.sdp },
        });
      } catch (error) {
        reportarError('call.llamar', error);
        aplicar({ tipo: 'colgada', at: Date.now(), porMi: true });
        getSocket()?.emit('call.end', { chatId: params.chatId, motivo: 'colgada' });
      }
    },
    [params.chatId, params.jwt, crearPc, agregarMedios, aplicar]
  );

  const contestar = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (!(await pedirPermisos(video))) return;
    try {
      await agregarMedios(pc, video);
      const respuesta = await pc.createAnswer();
      await pc.setLocalDescription(respuesta);
      getSocket()?.emit('call.answer', {
        chatId: params.chatId,
        sdp: { type: 'answer', sdp: respuesta.sdp },
      });
      aplicar({ tipo: 'contestada', at: Date.now() });
    } catch (error) {
      reportarError('call.contestar', error);
    }
  }, [params.chatId, video, agregarMedios, aplicar]);

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
    localStream,
    remoteStream,
    llamar,
    contestar,
    colgar,
    alternarMute: () =>
      setMuted((valor) => {
        const nuevo = !valor;
        localRef.current?.getAudioTracks().forEach((track) => (track.enabled = !nuevo));
        return nuevo;
      }),
    alternarAltavoz: () => setSpeaker((valor) => !valor),
    alternarVideo: () =>
      setVideo((valor) => {
        const nuevo = !valor;
        localRef.current?.getVideoTracks().forEach((track) => (track.enabled = nuevo));
        return nuevo;
      }),
    cerrar: () => {
      limpiar();
      setState(null);
    },
  };
}
