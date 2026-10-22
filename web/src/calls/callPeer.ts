import { api } from '../api';

/** The SDP and the candidates travel as plain objects through the socket, like the app's (`useCall.ts`). */
export type Sdp = { type: 'offer' | 'answer'; sdp: string };
export type Candidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };

const PUBLIC_STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };
/** Like the app: a slow server does not hold the call; it goes on with STUN. */
const ICE_WAIT_MS = 6_000;

/**
 * The ICE servers with the short TURN credential the server signs
 * (`GET /api/calls/ice`). Fails closed to STUN alone: a same-network call
 * still connects instead of breaking the attempt.
 */
export async function fetchIceServers(jwt: string): Promise<RTCIceServer[]> {
  const result = await api<{ iceServers?: RTCIceServer[] }>('/calls/ice', { jwt, signal: AbortSignal.timeout(ICE_WAIT_MS) });
  const servers = result.ok ? result.data.iceServers : undefined;
  return Array.isArray(servers) && servers.length > 0 ? servers : [PUBLIC_STUN];
}

/** Without these the camera is missing or busy, not refused: a video call goes on with the voice. */
const CAMERA_MISSING = new Set(['NotFoundError', 'OverconstrainedError', 'NotReadableError']);

/** A computer without a camera still takes and makes video calls, with its voice (like WhatsApp Web). */
async function requestMedia(video: boolean): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video });
  } catch (failure) {
    if (!video || !CAMERA_MISSING.has(errorName(failure))) throw failure;
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
}

export type CallPeer = {
  connection: RTCPeerConnection;
  /** Microphone, and the camera for a video call; the tracks go to the peer. */
  addLocalMedia: (video: boolean) => Promise<MediaStream>;
  /** The other side's description; the candidates that came before it are applied now. */
  setRemote: (sdp: Sdp) => Promise<void>;
  addCandidate: (candidate: Candidate) => Promise<void>;
  /** Closes the peer and releases the microphone and camera. Idempotent. */
  close: () => void;
};

/**
 * One call's RTCPeerConnection. A candidate that arrives BEFORE the remote
 * description is buffered and applied when it is set: `addIceCandidate`
 * would reject it and half the call would be lost (the app learned it, FL11).
 */
export function createCallPeer(params: {
  iceServers: RTCIceServer[];
  onCandidate: (candidate: Candidate) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onIceState: (state: RTCIceConnectionState) => void;
}): CallPeer {
  const connection = new RTCPeerConnection({ iceServers: params.iceServers });
  const buffered: Candidate[] = [];
  let remoteReady = false;
  let local: MediaStream | null = null;
  let closed = false;
  connection.onicecandidate = (event) => {
    const found = event.candidate;
    if (found) params.onCandidate({ candidate: found.candidate, sdpMid: found.sdpMid, sdpMLineIndex: found.sdpMLineIndex });
  };
  connection.ontrack = (event) => {
    const stream = event.streams[0];
    if (stream) params.onRemoteStream(stream);
  };
  connection.oniceconnectionstatechange = () => params.onIceState(connection.iceConnectionState);
  const apply = async (candidate: Candidate) => {
    try {
      await connection.addIceCandidate(candidate);
    } catch (error) {
      console.warn('[llamada] candidato descartado:', error);
    }
  };
  return {
    connection,
    addLocalMedia: async (video) => {
      const stream = await requestMedia(video);
      // Hung up while the browser asked: the microphone is released, not left on.
      if (closed) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException('La llamada ya terminó.', 'AbortError');
      }
      local = stream;
      for (const track of stream.getTracks()) connection.addTrack(track, stream);
      // No camera of mine, but the other's video is still received.
      if (video && stream.getVideoTracks().length === 0) connection.addTransceiver('video', { direction: 'recvonly' });
      return stream;
    },
    setRemote: async (sdp) => {
      await connection.setRemoteDescription(sdp);
      remoteReady = true;
      for (const candidate of buffered.splice(0)) await apply(candidate);
    },
    addCandidate: async (candidate) => {
      if (remoteReady) await apply(candidate);
      else buffered.push(candidate);
    },
    close: () => {
      closed = true;
      connection.close();
      local?.getTracks().forEach((track) => track.stop());
      local = null;
    },
  };
}

/** A DOMException's or an Error's name; not every runtime makes DOMException an Error. */
export function errorName(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? name : '';
}

/** What the call screen says when the browser does not give the microphone or the camera. */
export function mediaErrorText(error: unknown, video: boolean): string {
  const name = errorName(error);
  const device = video ? 'el micrófono y la cámara' : 'el micrófono';
  if (name === 'NotAllowedError' || name === 'SecurityError') return `Permite ${device} en el navegador para llamar.`;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return video ? 'No encontramos micrófono o cámara en esta computadora.' : 'No encontramos un micrófono en esta computadora.';
  if (name === 'NotReadableError') return `Otra aplicación está usando ${device}.`;
  return 'No se pudo iniciar la llamada.';
}
