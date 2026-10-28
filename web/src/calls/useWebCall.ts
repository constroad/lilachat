import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { mediaState, nextCallState, ringDeadline, ringStart, waitBeforeGivingUp, type CallEvent, type CallState, type MediaState } from '@lilachat/shared';
import { canSwitchCamera, otherFacing, type CameraFacing } from '@lilachat/shared';
import { currentSocket } from '../useSocket';
import { createCallPeer, errorName, fetchIceServers, mediaErrorText, type CallPeer, type Candidate, type Sdp } from './callPeer';

/** An offer as the server relays it: it adds who calls and what is left of the ring (`socket.ts`). */
export type IncomingOffer = { chatId: string; video?: boolean; sdp?: Sdp; fromName?: string | null; fromPhone?: string; quedaMs?: number };
type Session = { chatId: string; peerName: string; videoCall: boolean };

const emit = (event: string, frame: object) => void currentSocket()?.emit(event, frame);
/** The call ended while the browser was asking for the microphone (`callPeer.ts`): nothing to say. */
const isAbort = (failure: unknown) => errorName(failure) === 'AbortError';

/**
 * Calls on the web (José, 21/10: why can't the web make and answer calls?),
 * with the SAME signaling as the app: `call.offer`,
 * `call.answer`, `call.ice`, `call.end`, `call.reject` through the session's
 * socket. The server is only the mailman; audio and video go between the two,
 * or through the TURN. The state comes from `shared/call.ts`; whether the
 * audio flows, from `shared/callMedia.ts`. The call is the SESSION's: it
 * rings over whatever chat is open.
 */
export function useWebCall(params: { jwt: string; connected: boolean; nameOf: (offer: IncomingOffer) => string }) {
  const [state, setState] = useState<CallState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [media, setMedia] = useState<MediaState>('conectando');
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  /** Front or rear (pending 97), and how many cameras the device has: the switch shows with two. */
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [cameras, setCameras] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<CallState | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const peerRef = useRef<CallPeer | null>(null);
  /** Candidates that came before the peer existed (it waits for the ICE servers). */
  const early = useRef<Candidate[]>([]);
  const connectedOnce = useRef(false);
  const nameOfRef = useRef(params.nameOf);
  nameOfRef.current = params.nameOf;
  const jwtRef = useRef(params.jwt);
  jwtRef.current = params.jwt;

  const setCall = useCallback((next: CallState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const apply = useCallback((event: CallEvent) => {
    if (stateRef.current) setCall(nextCallState(stateRef.current, event));
  }, [setCall]);
  const startSession = useCallback((next: Session) => {
    sessionRef.current = next;
    setSession(next);
    setCameraOn(next.videoCall);
    setFacing('user');
    setMuted(false);
    setError(null);
  }, []);
  const isThisCall = (chatId: string) => sessionRef.current?.chatId === chatId;
  // A function: after an `await` the ref may hold another phase, which TypeScript's narrowing cannot see.
  const currentPhase = (): CallState['fase'] | undefined => stateRef.current?.fase;

  const release = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    early.current = [];
    connectedOnce.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setMedia('conectando');
  }, []);

  /** The audio does not flow: hang up and tell the other, instead of a mute clock. */
  const giveUp = useCallback(() => {
    if (sessionRef.current) emit('call.end', { chatId: sessionRef.current.chatId, motivo: 'desconectada' });
    apply({ tipo: 'desconectada', at: Date.now() });
  }, [apply]);

  const openPeer = useCallback(async (): Promise<CallPeer> => {
    const iceServers = await fetchIceServers(jwtRef.current);
    const peer: CallPeer = createCallPeer({
      iceServers,
      onCandidate: (candidate) => sessionRef.current && emit('call.ice', { chatId: sessionRef.current.chatId, candidate }),
      onRemoteStream: setRemoteStream,
      onIceState: (ice) => {
        if (peerRef.current !== peer) return;
        const next = mediaState(ice, connectedOnce.current);
        if (next === 'conectada') connectedOnce.current = true;
        setMedia(next);
        if (next === 'fallo') giveUp();
      },
    });
    peerRef.current = peer;
    for (const candidate of early.current.splice(0)) await peer.addCandidate(candidate);
    return peer;
  }, [giveUp]);

  // It hangs up alone if nobody answers; an endless «Llamando…» helps nobody. «Answering» moves the deadline (backlog 114).
  useEffect(() => {
    const deadline = state ? ringDeadline(state) : null;
    if (deadline === null) return;
    const timer = window.setTimeout(() => apply({ tipo: 'tiempo', at: Math.max(Date.now(), deadline) }), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [state, apply]);
  useEffect(() => {
    if (state?.fase === 'terminada') release();
  }, [state?.fase, release]);
  useEffect(() => release, [release]);
  // Answered but without audio (or it was cut and does not come back): a limit, then it hangs up.
  const active = state?.fase === 'activa';
  useEffect(() => {
    const wait = waitBeforeGivingUp(media);
    if (!active || wait === null) return;
    const timer = window.setTimeout(giveUp, wait);
    return () => window.clearTimeout(timer);
  }, [active, media, giveUp]);

  useIncomingSignals({ connected: params.connected, jwt: params.jwt, stateRef, peerRef, early, isThisCall, apply, setCall, startSession, openPeer, nameOfRef });

  const call = useCallback(async (chatId: string, peerName: string, video: boolean) => {
    if (stateRef.current && stateRef.current.fase !== 'terminada') return;
    startSession({ chatId, peerName, videoCall: video });
    setCall({ fase: 'llamando', desde: Date.now(), entrante: false });
    try {
      const peer = await openPeer();
      const stream = await peer.addLocalMedia(video);
      setLocalStream(stream);
      setCameraOn(stream.getVideoTracks().length > 0);
      // Hung up while the browser asked for the microphone: nothing to send.
      if (!isThisCall(chatId) || currentPhase() !== 'llamando') return;
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      emit('call.offer', { chatId, video, sdp: { type: 'offer', sdp: offer.sdp } });
    } catch (failure) {
      if (isAbort(failure)) return;
      setError(mediaErrorText(failure, video));
      emit('call.end', { chatId, motivo: 'colgada' });
      apply({ tipo: 'colgada', at: Date.now(), porMi: true });
    }
  }, [apply, openPeer, setCall, startSession]);

  const answer = useCallback(async () => {
    const peer = peerRef.current;
    const current = sessionRef.current;
    if (!peer || !current) return;
    // Backlog 114: said at the tap, before the browser asks for the microphone.
    if (stateRef.current?.fase === 'sonando') {
      emit('call.answering', { chatId: current.chatId });
      apply({ tipo: 'answering', at: Date.now() });
    }
    try {
      const stream = await peer.addLocalMedia(current.videoCall);
      setLocalStream(stream);
      setCameraOn(stream.getVideoTracks().length > 0);
      const reply = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(reply);
      emit('call.answer', { chatId: current.chatId, sdp: { type: 'answer', sdp: reply.sdp } });
      apply({ tipo: 'contestada', at: Date.now() });
    } catch (failure) {
      if (isAbort(failure)) return;
      setError(mediaErrorText(failure, current.videoCall));
      emit('call.end', { chatId: current.chatId, motivo: 'colgada' });
      apply({ tipo: 'colgada', at: Date.now(), porMi: true });
    }
  }, [apply]);

  /** Always told to the other, also when declining: their phone has to stop ringing. */
  const hangUp = useCallback(() => {
    if (sessionRef.current) emit('call.end', { chatId: sessionRef.current.chatId, motivo: 'colgada' });
    apply(stateRef.current?.fase === 'sonando' ? { tipo: 'rechazada', at: Date.now() } : { tipo: 'colgada', at: Date.now(), porMi: true });
  }, [apply]);

  const close = useCallback(() => {
    release();
    setCall(null);
    sessionRef.current = null;
    setSession(null);
  }, [release, setCall]);

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      localStream?.getAudioTracks().forEach((track) => (track.enabled = wasMuted));
      return !wasMuted;
    });
  }, [localStream]);
  const toggleCamera = useCallback(() => {
    if (!sessionRef.current?.videoCall || !localStream?.getVideoTracks().length) return;
    setCameraOn((wasOn) => {
      localStream?.getVideoTracks().forEach((track) => (track.enabled = !wasOn));
      return !wasOn;
    });
  }, [localStream]);

  useEffect(() => {
    // An old browser without the listing gets no switch.
    const listing = localStream?.getVideoTracks().length ? navigator.mediaDevices?.enumerateDevices?.() : undefined;
    if (!listing) return setCameras(0);
    let alive = true;
    void listing
      .then((devices) => alive && setCameras(devices.filter((device) => device.kind === 'videoinput').length))
      .catch(() => alive && setCameras(0));
    return () => {
      alive = false;
    };
  }, [localStream]);
  const switchCamera = useCallback(async () => {
    const next = otherFacing(facing);
    try {
      if (await peerRef.current?.switchCamera(next)) setFacing(next);
    } catch (failure) {
      console.warn('[llamada] no se pudo girar la cámara:', failure);
    }
  }, [facing]);

  return { state, session, media, muted, cameraOn, facing, canSwitch: canSwitchCamera(cameras), localStream, remoteStream, error, call, answer, hangUp, close, toggleMute, toggleCamera, switchCamera };
}

export type WebCall = ReturnType<typeof useWebCall>;

/** The socket side: an offer rings (or gets «busy»), an answer connects, candidates, and the end. */
function useIncomingSignals(deps: {
  connected: boolean;
  jwt: string;
  stateRef: MutableRefObject<CallState | null>;
  peerRef: MutableRefObject<CallPeer | null>;
  early: MutableRefObject<Candidate[]>;
  isThisCall: (chatId: string) => boolean;
  apply: (event: CallEvent) => void;
  setCall: (next: CallState | null) => void;
  startSession: (next: Session) => void;
  openPeer: () => Promise<CallPeer>;
  nameOfRef: MutableRefObject<(offer: IncomingOffer) => string>;
}) {
  const latest = useRef(deps);
  latest.current = deps;
  // Read on every render: if the session's socket is replaced (a new token, the
  // server cut it) the listeners move to the new one even when `connected` was
  // true before and after. The provider is a child of the shell, so its effect
  // runs before the one that creates the socket: `connected` brings it back.
  const socket = currentSocket();
  useEffect(() => {
    if (!socket) return;
    const incoming = async (offer: IncomingOffer) => {
      const { stateRef, isThisCall, setCall, startSession, openPeer, nameOfRef } = latest.current;
      if (stateRef.current && stateRef.current.fase !== 'terminada') {
        if (!isThisCall(offer.chatId)) socket.emit('call.reject', { chatId: offer.chatId, motivo: 'ocupado' });
        return;
      }
      startSession({ chatId: offer.chatId, peerName: nameOfRef.current(offer), videoCall: offer.video === true });
      setCall({ fase: 'sonando', desde: ringStart(offer.quedaMs, Date.now()), entrante: true });
      try {
        const peer = await openPeer();
        if (offer.sdp) await peer.setRemote(offer.sdp);
      } catch (failure) {
        console.warn('[llamada] no se pudo preparar la entrante:', failure);
      }
    };
    const answered = async (frame: { chatId: string; sdp?: Sdp }) => {
      const { isThisCall, peerRef, apply } = latest.current;
      if (!isThisCall(frame.chatId)) return;
      try {
        if (peerRef.current && frame.sdp) await peerRef.current.setRemote(frame.sdp);
      } catch (failure) {
        console.warn('[llamada] respuesta inválida:', failure);
      }
      apply({ tipo: 'contestada', at: Date.now() });
    };
    const answering = (frame: { chatId: string }) => {
      const { isThisCall, apply } = latest.current;
      if (isThisCall(frame.chatId)) apply({ tipo: 'answering', at: Date.now() });
    };
    const candidate = (frame: { chatId: string; candidate?: Candidate }) => {
      const { isThisCall, peerRef, early } = latest.current;
      if (!isThisCall(frame.chatId) || !frame.candidate) return;
      if (peerRef.current) void peerRef.current.addCandidate(frame.candidate);
      else early.current.push(frame.candidate);
    };
    const ended = (frame: { chatId: string; motivo?: string }) => {
      const { isThisCall, apply } = latest.current;
      if (!isThisCall(frame.chatId)) return;
      apply(frame.motivo === 'ocupado' ? { tipo: 'ocupado', at: Date.now() } : { tipo: 'colgada', at: Date.now(), porMi: false });
    };
    socket.on('call.offer', incoming);
    socket.on('call.answer', answered);
    socket.on('call.answering', answering);
    socket.on('call.ice', candidate);
    socket.on('call.end', ended);
    socket.on('call.reject', ended);
    return () => {
      socket.off('call.offer', incoming);
      socket.off('call.answer', answered);
      socket.off('call.answering', answering);
      socket.off('call.ice', candidate);
      socket.off('call.end', ended);
      socket.off('call.reject', ended);
    };
  }, [socket, deps.connected, deps.jwt]);
}
