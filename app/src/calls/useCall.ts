import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Vibration } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';
import type RTCIceCandidateEvent from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent';
import { callReactionOf, createAckWatch, nextCallState, reactionKeyOf, reactionNotSeenNotice, ringDeadline, type CallReaction, type CallState, type CameraFacing } from '@lilachat/shared';
import { switchCameraTrack } from './cameraSwitch';
import { useNoiseSuppression } from './noiseSuppression';
import { useScreenShare } from './useScreenShare';
import { connectSocket, getSocket, sostenerPorLlamada } from '../chat/socketClient';
import { obtenerIceServers, type ServidorIce } from './iceServers';
import { esperaAntesDeRendirse, estadoDeMedios, type EstadoDeMedios } from './estadoDeMedios';
import { announcesAnswering, comoSuena, inicioDelTimbre, necesitaServicioDeLlamada, queHacerConElAviso, suenaTonoDeLlamando } from './llamadaNativa';
import { detenerTonoDeLlamando, iniciarTonoDeLlamando } from './tonoDeLlamando';
import { llamadaNativa, type AccionDeAviso } from '../../modules/llamada-entrante/src';
import type { CallNoticeTap } from '../../modules/llamada-entrante/src';
import { reportarError } from '../ui/reportarError';

/** El SDP y los candidatos viajan como objetos planos por el socket. */
type Sdp = { type: 'offer' | 'answer'; sdp: string };
type Candidato = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
/** Quién llama, como lo manda el server en la oferta. */
export type AutorDeLlamada = { nombre?: string | null; telefono?: string };

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
 * llamada. STUN + TURN de Cloudflare, con credencial corta del server (`iceServers`).
 */
async function pedirPermisos(conVideo: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const permisos = conVideo
    ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA]
    : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  const resultado = await PermissionsAndroid.requestMultiple(permisos);
  return permisos.every((permiso) => resultado[permiso] === PermissionsAndroid.RESULTS.GRANTED);
}

/** El patrón del timbre: vibra 0,8 s, pausa 1,2 s, repite mientras suena. */
const TIMBRE = [0, 800, 1200];
/**
 * Cuánto se espera la oferta después de abrir la app desde la notificación
 * (FL8.1). Llega por el socket al conectar; si no llegó, la llamada ya no
 * existe y la app deja de mostrarse sobre el bloqueo.
 */
const ESPERA_DE_LA_OFERTA_MS = 8_000;
/** How long a notice over the call stays (pending 105b). */
const NOTICE_MS = 6_000;

/**
 * Desde FL8 la llamada es de la SESIÓN, no de una pantalla de chat: el chat se
 * fija al llamar (`llamar(chatId, …)`) o al llegar una oferta de cualquier
 * conversación. Antes el hook vivía en `ChatScreen` y solo escuchaba ese chat:
 * si el otro estaba en la lista o en otro chat, no sonaba nada.
 */
export function useCall(params: { jwt: string; nombreDe: (chatId: string, autor?: AutorDeLlamada) => string }) {
  const [state, setState] = useState<CallState | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('');
  /** Empezó como videollamada: solo ahí la cámara se prende y apaga de verdad. */
  const [conVideoDesdeElInicio, setConVideoDesdeElInicio] = useState(false);
  const chatIdRef = useRef<string | null>(null);
  const nombreDeRef = useRef(params.nombreDe);
  nombreDeRef.current = params.nombreDe;
  const [video, setVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  /** Front or rear camera (pending 97); every call starts with the front one. */
  const [facing, setFacing] = useState<CameraFacing>('user');
  const switchingRef = useRef(false);
  /** The last wink or sticker played over the call (pending 98), mine or the other's. */
  const [reaction, setReaction] = useState<{ reaction: CallReaction; key: number } | null>(null);
  /** Pending 105b: the other did not answer «seen» to my last reaction. */
  const [notice, setNotice] = useState<string | null>(null);
  const [ackWatch] = useState(() => createAckWatch(() => setNotice(reactionNotSeenNotice(nombreRef.current))));
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  /** Lo que se tocó en la notificación antes de que llegara la oferta (FL8.1). */
  const avisoPendiente = useRef<AccionDeAviso | null>(null);
  const aplicarAvisoRef = useRef<(aviso: AccionDeAviso) => void>(() => undefined);
  const nombreRef = useRef('');
  /** Contestar desde la notificación corre en el mismo tick que `setVideo`. */
  const conVideoRef = useRef(false);
  const [appActiva, setAppActiva] = useState(AppState.currentState === 'active');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  /** Si el audio pasa de verdad; «contestada» solo dice que el otro aceptó. */
  const [medios, setMedios] = useState<EstadoDeMedios>('conectando');
  const yaConecto = useRef(false);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const noise = useNoiseSuppression();
  const localRef = useRef<MediaStream | null>(null);
  const screen = useScreenShare(pcRef, localRef, state?.fase === 'activa' && video);
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
    setFacing('user');
    setReaction(null);
    setNotice(null);
    ackWatch.stop();
    buffer.current = [];
    remotoListo.current = false;
    yaConecto.current = false;
    setMedios('conectando');
  }, [ackWatch]);

  /** El audio no pasa: se corta y se avisa al otro, en vez de un reloj mudo. */
  const rendirse = useCallback(() => {
    getSocket()?.emit('call.end', { chatId: chatIdRef.current, motivo: 'desconectada' });
    aplicar({ tipo: 'desconectada', at: Date.now() });
  }, [aplicar]);

  const crearPc = useCallback((iceServers: ServidorIce[]): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (evento: RTCIceCandidateEvent<'icecandidate'>) => {
      const candidato = evento.candidate;
      if (candidato) {
        // Objeto plano, no la instancia: socket.io serializa solo lo enumerable.
        getSocket()?.emit('call.ice', {
          chatId: chatIdRef.current,
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
    pc.oniceconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      const nuevo = estadoDeMedios(pc.iceConnectionState, yaConecto.current);
      if (nuevo === 'conectada') yaConecto.current = true;
      setMedios(nuevo);
      // ICE `failed` no se recupera solo.
      if (nuevo === 'fallo') rendirse();
    };
    pcRef.current = pc;
    return pc;
  }, [rendirse]);

  const agregarMedios = useCallback(
    async (pc: RTCPeerConnection, conVideo: boolean): Promise<void> => {
      const stream = await mediaDevices.getUserMedia({ audio: noise.constraints(), video: conVideo });
      localRef.current = stream;
      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    },
    [noise]
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
  // «Answering» moves the deadline (backlog 114).
  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    const deadline = state ? ringDeadline(state) : null;
    if (deadline === null) return;
    timeout.current = setTimeout(
      () => aplicar({ tipo: 'tiempo', at: Math.max(Date.now(), deadline) }),
      Math.max(0, deadline - Date.now())
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

  // On connecting, a video call goes to the speaker and a voice call to the earpiece (like WhatsApp).
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const enCurso = state?.fase === 'activa';

  // FL11 (José, 18/10): al cambiar de app se dejaba de oír. Mientras haya
  // llamada, el servicio «Llamada en curso» mantiene viva la app y el socket no
  // se pausa (por ahí llega que el otro colgó).
  const sostener = necesitaServicioDeLlamada(state);
  const conectadaEn = state?.fase === 'activa' ? state.conectadaEn : 0;
  useEffect(() => {
    if (!sostener) return;
    sostenerPorLlamada(true);
    return () => {
      sostenerPorLlamada(false);
      llamadaNativa.finDeEnCurso();
    };
  }, [sostener]);
  useEffect(() => {
    // Llamando, sin cronómetro; contestada, con el reloj desde que conectó.
    if (sostener && chatIdRef.current) llamadaNativa.enCurso(chatIdRef.current, nombreRef.current, conVideoRef.current, conectadaEn);
  }, [sostener, conectadaEn]);
  useEffect(() => {
    if (!enCurso) return;
    void setAudioModeAsync({ shouldRouteThroughEarpiece: !speakerRef.current }).catch((error) => reportarError('call.audio', error));
  }, [enCurso]);

  // Contestada pero sin audio (o se cortó y no vuelve): tope y se corta.
  useEffect(() => {
    const espera = esperaAntesDeRendirse(medios);
    if (!enCurso || espera === null) return;
    const temporizador = setTimeout(rendirse, espera);
    return () => clearTimeout(temporizador);
  }, [enCurso, medios, rendirse]);

  // Vibra mientras suena una entrante (FL8): antes no sonaba ni vibraba nada.
  const sonandoEntrante = state?.fase === 'sonando' && state.entrante;
  useEffect(() => {
    if (!sonandoEntrante) return;
    Vibration.vibrate(TIMBRE, true);
    return () => Vibration.cancel();
  }, [sonandoEntrante]);

  // Mientras llamo, el «tuu… tuu» (20/10): se corta al contestar, rechazar o colgar.
  const llamandoSaliente = suenaTonoDeLlamando(state);
  useEffect(() => {
    if (!llamandoSaliente) return;
    iniciarTonoDeLlamando();
    return () => detenerTonoDeLlamando();
  }, [llamandoSaliente]);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => setAppActiva(estado === 'active'));
    return () => suscripcion.remove();
  }, []);

  // FL8.1: adelante suena el tono del teléfono; de fondo (socket vivo, por
  // ejemplo con «Conexión permanente») la llamada se dibuja a pantalla completa.
  useEffect(() => {
    const modo = comoSuena({ sonandoEntrante, appActiva });
    const chat = chatIdRef.current;
    if (modo === 'tono') {
      llamadaNativa.iniciarTono();
      return () => llamadaNativa.detenerTono();
    }
    if (modo === 'aviso-nativo' && chat) {
      llamadaNativa.mostrar(chat, nombreRef.current, conVideoRef.current);
      return () => llamadaNativa.quitar(chat);
    }
  }, [sonandoEntrante, appActiva]);

  // Sin llamada, la app vuelve detrás del bloqueo.
  useEffect(() => {
    if (!state) llamadaNativa.soltarBloqueo();
  }, [state]);

  useEffect(() => {
    // `connectSocket` reusa el socket vivo (o lo crea): este hook se monta con
    // la sesión, a veces antes que la lista, y tiene que escuchar desde ya.
    const socket = connectSocket(params.jwt);
    const esDeEstaLlamada = (otroChat: string) => otroChat === chatIdRef.current;

    const entrante = async (data: {
      chatId: string;
      video?: boolean;
      sdp?: Sdp;
      fromName?: string | null;
      fromPhone?: string;
      /** Lo que le queda de timbre, si llegó tarde (FL8.1). */
      quedaMs?: number;
    }) => {
      const actual = stateRef.current;
      // Si YA hay una llamada, la nueva recibe «ocupado» sin pisar la que está.
      if (actual && actual.fase !== 'terminada') {
        socket.emit('call.reject', { chatId: data.chatId, motivo: 'ocupado' });
        return;
      }
      chatIdRef.current = data.chatId;
      setChatId(data.chatId);
      nombreRef.current = nombreDeRef.current(data.chatId, { nombre: data.fromName, telefono: data.fromPhone });
      setPeerName(nombreRef.current);
      conVideoRef.current = Boolean(data.video);
      setVideo(Boolean(data.video));
      setConVideoDesdeElInicio(Boolean(data.video));
      // El ref YA: si se tocó «Contestar» en la notificación, se decide en
      // este mismo tick, antes del render que actualizaría el ref.
      const sonando: CallState = { fase: 'sonando', desde: inicioDelTimbre(data.quedaMs, Date.now()), entrante: true };
      stateRef.current = sonando;
      setState(sonando);
      try {
        const pc = crearPc(await obtenerIceServers(params.jwt));
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await drenarCandidatos(pc);
        }
      } catch (error) {
        reportarError('call.entrante', error);
      }
      const pendiente = avisoPendiente.current;
      if (pendiente?.chatId === data.chatId) aplicarAvisoRef.current(pendiente);
    };

    const contestada = async (data: { chatId: string; sdp?: Sdp }) => {
      if (!esDeEstaLlamada(data.chatId)) return;
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
      if (!esDeEstaLlamada(data.chatId) || !data.candidate) return;
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

    // Backlog 114: the other side tapped «Contestar» (maybe on its lock screen): wait in «Conectando…».
    const answering = (data: { chatId: string }) => {
      if (esDeEstaLlamada(data.chatId)) aplicar({ tipo: 'answering', at: Date.now() });
    };

    const terminada = (data: { chatId: string; motivo?: string }) => {
      if (!esDeEstaLlamada(data.chatId)) return;
      aplicar(
        data.motivo === 'ocupado'
          ? { tipo: 'ocupado', at: Date.now() }
          : { tipo: 'colgada', at: Date.now(), porMi: false }
      );
    };

    socket.on('call.offer', entrante);
    socket.on('call.answer', contestada);
    socket.on('call.answering', answering);
    socket.on('call.ice', hielo);
    socket.on('call.end', terminada);
    socket.on('call.reject', terminada);
    const onReaction = (data: { chatId: string; reaction?: unknown; key?: unknown }) => {
      const played = esDeEstaLlamada(data.chatId) ? callReactionOf(data.reaction) : null;
      if (!played) return;
      setReaction({ reaction: played, key: Date.now() });
      const key = reactionKeyOf(data.key);
      if (key) socket.emit('call.reaction.ack', { chatId: data.chatId, key });
    };
    const onReactionSeen = (data: { chatId: string; key?: unknown }) => {
      const key = esDeEstaLlamada(data.chatId) ? reactionKeyOf(data.key) : null;
      if (key) ackWatch.seen(key);
    };
    socket.on('call.reaction', onReaction);
    socket.on('call.reaction.ack', onReactionSeen);

    return () => {
      socket.off('call.reaction', onReaction);
      socket.off('call.reaction.ack', onReactionSeen);
      socket.off('call.offer', entrante);
      socket.off('call.answer', contestada);
      socket.off('call.answering', answering);
      socket.off('call.ice', hielo);
      socket.off('call.end', terminada);
      socket.off('call.reject', terminada);
    };
  }, [params.jwt, aplicar, crearPc, drenarCandidatos, ackWatch]);

  const llamar = useCallback(
    async (chatDestino: string, nombre: string, conVideo: boolean) => {
      if (stateRef.current && stateRef.current.fase !== 'terminada') return;
      if (!(await pedirPermisos(conVideo))) return;
      chatIdRef.current = chatDestino;
      setChatId(chatDestino);
      nombreRef.current = nombre;
      conVideoRef.current = conVideo;
      setPeerName(nombre);
      setVideo(conVideo);
      setConVideoDesdeElInicio(conVideo);
      setSpeaker(conVideo);
      setState({ fase: 'llamando', desde: Date.now(), entrante: false });
      try {
        const pc = crearPc(await obtenerIceServers(params.jwt));
        await agregarMedios(pc, conVideo);
        const oferta = await pc.createOffer({});
        await pc.setLocalDescription(oferta);
        getSocket()?.emit('call.offer', {
          chatId: chatDestino,
          video: conVideo,
          sdp: { type: 'offer', sdp: oferta.sdp },
        });
      } catch (error) {
        reportarError('call.llamar', error);
        aplicar({ tipo: 'colgada', at: Date.now(), porMi: true });
        getSocket()?.emit('call.end', { chatId: chatDestino, motivo: 'colgada' });
      }
    },
    [params.jwt, crearPc, agregarMedios, aplicar]
  );

  /**
   * Backlog 114: «answering» goes out at the tap, before the mic, the camera and
   * the answer, which can take seconds on a phone that was just unlocked.
   */
  const announceAnswering = useCallback(() => {
    if (stateRef.current?.fase !== 'sonando') return;
    getSocket()?.emit('call.answering', { chatId: chatIdRef.current });
    aplicar({ tipo: 'answering', at: Date.now() });
  }, [aplicar]);

  const contestar = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    announceAnswering();
    const conVideo = conVideoRef.current;
    if (!(await pedirPermisos(conVideo))) return;
    try {
      await agregarMedios(pc, conVideo);
      const respuesta = await pc.createAnswer();
      await pc.setLocalDescription(respuesta);
      setSpeaker(conVideo);
      getSocket()?.emit('call.answer', {
        chatId: chatIdRef.current,
        sdp: { type: 'answer', sdp: respuesta.sdp },
      });
      aplicar({ tipo: 'contestada', at: Date.now() });
    } catch (error) {
      reportarError('call.contestar', error);
    }
  }, [agregarMedios, aplicar, announceAnswering]);

  const colgar = useCallback(() => {
    // Se avisa SIEMPRE, incluso rechazando: el otro tiene que dejar de sonar.
    getSocket()?.emit('call.end', { chatId: chatIdRef.current, motivo: 'colgada' });
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
  }, []);

  /** Lo que se tocó en la notificación de llamada (FL8.1). */
  const aplicarAviso = useCallback(
    (aviso: CallNoticeTap) => {
      // Backlog 114: «Contestar» on the lock screen; the activity brings «contestar» right after.
      if (aviso.accion === 'answering') {
        if (announcesAnswering({ tap: aviso, state: stateRef.current, callChatId: chatIdRef.current })) announceAnswering();
        return;
      }
      const decision = queHacerConElAviso({ aviso, estado: stateRef.current, chatId: chatIdRef.current });
      if (decision === 'esperar') {
        avisoPendiente.current = aviso;
        // Si la oferta no llega, la llamada ya no existe: la app vuelve detrás
        // del bloqueo en vez de quedar abierta para cualquiera.
        setTimeout(() => {
          if (avisoPendiente.current !== aviso) return;
          avisoPendiente.current = null;
          if (!stateRef.current) llamadaNativa.soltarBloqueo();
        }, ESPERA_DE_LA_OFERTA_MS);
        return;
      }
      avisoPendiente.current = null;
      if (decision === 'contestar') void contestar();
      else if (decision === 'colgar') colgar();
    },
    [contestar, colgar, announceAnswering]
  );
  aplicarAvisoRef.current = aplicarAviso;

  /** Quitar la pantalla de llamada. Estable: el proveedor la programa con un temporizador. */
  const cerrar = useCallback(() => {
    limpiar();
    setState(null);
    chatIdRef.current = null;
    setChatId(null);
  }, [limpiar]);

  // Stable: the overlay's timer restarts when its `onDone` changes, and the call screen repaints every second.
  const clearReaction = useCallback(() => setReaction(null), []);

  return {
    state,
    medios,
    chatId,
    peerName,
    conVideoDesdeElInicio,
    video,
    muted,
    speaker,
    localStream,
    remoteStream,
    llamar,
    contestar,
    colgar,
    aplicarAviso,
    alternarMute: () =>
      setMuted((valor) => {
        const nuevo = !valor;
        localRef.current?.getAudioTracks().forEach((track) => (track.enabled = !nuevo));
        return nuevo;
      }),
    noiseSuppression: noise.on,
    setNoiseSuppression: (on: boolean) => void noise.set(on, { pc: pcRef.current, stream: localRef.current, muted }),
    screen,
    // Real speaker (FL8): `expo-audio` routes to the loudspeaker or the earpiece (`setSpeakerphoneOn`); checked on a real phone.
    alternarAltavoz: () =>
      setSpeaker((valor) => {
        const nuevo = !valor;
        void setAudioModeAsync({ shouldRouteThroughEarpiece: !nuevo }).catch((error) => reportarError('call.altavoz', error));
        return nuevo;
      }),
    facing,
    reaction,
    notice,
    sendReaction: (sent: CallReaction) => {
      if (!chatIdRef.current) return;
      const key = `k-${Date.now()}`;
      setNotice(null);
      getSocket()?.emit('call.reaction', { chatId: chatIdRef.current, reaction: sent, key });
      ackWatch.sent(key);
      setReaction({ reaction: sent, key: Date.now() });
    },
    clearReaction,
    switchCamera: () => switchCameraTrack({ track: localRef.current?.getVideoTracks()[0], facing, switching: switchingRef, onSwitched: setFacing }),
    alternarVideo: () =>
      setVideo((valor) => {
        const nuevo = !valor;
        localRef.current?.getVideoTracks().forEach((track) => (track.enabled = nuevo));
        return nuevo;
      }),
    cerrar,
  };
}
