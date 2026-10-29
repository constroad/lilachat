import { callAudioConstraints, type CameraFacing } from '@lilachat/shared';
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
async function requestMedia(video: boolean, noiseSuppression: boolean): Promise<MediaStream> {
  const audio = callAudioConstraints(noiseSuppression);
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video });
  } catch (failure) {
    if (!video || !CAMERA_MISSING.has(errorName(failure))) throw failure;
    return navigator.mediaDevices.getUserMedia({ audio, video: false });
  }
}

/** A track replaces another in its sender and in the local stream, without renegotiating. */
async function swapTrack(sender: RTCRtpSender, stream: MediaStream, old: MediaStreamTrack, fresh: MediaStreamTrack): Promise<void> {
  fresh.enabled = old.enabled;
  await sender.replaceTrack(fresh);
  stream.removeTrack(old);
  old.stop();
  stream.addTrack(fresh);
}

/** A phone browser may not open both cameras at once: the old one is released and it is tried again. */
async function openCamera(facing: CameraFacing, current: MediaStreamTrack): Promise<MediaStreamTrack | null> {
  const ask = async () => (await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { exact: facing } } })).getVideoTracks()[0] ?? null;
  try {
    return await ask();
  } catch (failure) {
    if (errorName(failure) !== 'NotReadableError') throw failure;
    current.stop();
    return ask();
  }
}

export type CallPeer = {
  connection: RTCPeerConnection;
  /** Microphone, and the camera for a video call; the tracks go to the peer. */
  addLocalMedia: (video: boolean, noiseSuppression: boolean) => Promise<MediaStream>;
  /** The other side's description; the candidates that came before it are applied now. */
  setRemote: (sdp: Sdp) => Promise<void>;
  addCandidate: (candidate: Candidate) => Promise<void>;
  /** The other camera (pending 97): its track replaces the old one in the same sender, without renegotiating. */
  switchCamera: (facing: CameraFacing) => Promise<boolean>;
  /** A new microphone with the filter on or off (pending 3): it replaces the old one in the same sender. */
  setNoiseSuppression: (on: boolean) => Promise<boolean>;
  /**
   * The screen goes out in place of the camera, in the same sender. It comes
   * back with `stopScreen`, or alone when the browser's «Dejar de compartir»
   * ends the screen track (then `onEnded` says so).
   */
  shareScreen: (onEnded: () => void) => Promise<boolean>;
  stopScreen: () => Promise<void>;
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
  /** While the screen is shared: its track, and the camera that comes back after. */
  let screen: { track: MediaStreamTrack; camera: MediaStreamTrack; sender: RTCRtpSender } | null = null;
  const restoreCamera = async () => {
    const sharing = screen;
    if (!sharing) return;
    screen = null;
    sharing.track.onended = null;
    sharing.track.stop();
    if (!closed) await sharing.sender.replaceTrack(sharing.camera);
  };
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
    addLocalMedia: async (video, noiseSuppression) => {
      const stream = await requestMedia(video, noiseSuppression);
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
    switchCamera: async (facing) => {
      const old = local?.getVideoTracks()[0];
      const sender = connection.getSenders().find((one) => one.track?.kind === 'video');
      if (!local || !old || !sender) return false;
      const fresh = await openCamera(facing, old);
      if (!fresh) return false;
      if (closed) {
        fresh.stop();
        return false;
      }
      await swapTrack(sender, local, old, fresh);
      return true;
    },
    setNoiseSuppression: async (on) => {
      const old = local?.getAudioTracks()[0];
      const sender = connection.getSenders().find((one) => one.track?.kind === 'audio');
      if (!local || !old || !sender) return false;
      const fresh = (await navigator.mediaDevices.getUserMedia({ audio: callAudioConstraints(on), video: false })).getAudioTracks()[0];
      if (!fresh) return false;
      if (closed) {
        fresh.stop();
        return false;
      }
      await swapTrack(sender, local, old, fresh);
      return true;
    },
    shareScreen: async (onEnded) => {
      const camera = local?.getVideoTracks()[0];
      const sender = connection.getSenders().find((one) => one.track?.kind === 'video');
      if (!camera || !sender || screen) return false;
      const shared = (await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })).getVideoTracks()[0];
      if (!shared) return false;
      if (closed) {
        shared.stop();
        return false;
      }
      // Text and slides: sharpness before motion.
      shared.contentHint = 'detail';
      shared.onended = () => void restoreCamera().then(onEnded);
      screen = { track: shared, camera, sender };
      await sender.replaceTrack(shared);
      return true;
    },
    stopScreen: () => restoreCamera(),
    close: () => {
      closed = true;
      screen?.track.stop();
      screen = null;
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
