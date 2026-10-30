import type { MediaStream, MediaStreamTrack, RTCPeerConnection, RTCRtpSender } from 'react-native-webrtc';

/**
 * Sharing the phone's screen in a video call (APK 0.1.175; the web has it
 * since pending 3). react-native-webrtc asks Android for consent, starts its
 * `mediaProjection` foreground service and captures; the shared screen goes
 * into the camera's sender, so nothing is renegotiated, and the camera keeps
 * running underneath to come back when sharing stops. PURE: the capture is
 * passed in, so the test needs no phone.
 */
export type ScreenShare = { track: MediaStreamTrack; camera: MediaStreamTrack; sender: RTCRtpSender };
type DisplayMedia = () => Promise<Pick<MediaStream, 'getVideoTracks'>>;
type ShareParams = { pc: Pick<RTCPeerConnection, 'getSenders'>; stream: Pick<MediaStream, 'getVideoTracks'>; getDisplayMedia: DisplayMedia; onEnded: () => void };

const isRefusal = (error: unknown) => (error as { name?: string } | null)?.name === 'NotAllowedError' || String(error).includes('NotAllowedError');

/** `null` without a camera to swap, or when the person closes Android's consent dialog. */
export async function startScreenShare(params: ShareParams): Promise<ScreenShare | null> {
  const camera = params.stream.getVideoTracks()[0];
  const sender = params.pc.getSenders().find((one) => one.track?.kind === 'video');
  if (!camera || !sender) return null;
  let screen: MediaStreamTrack | undefined;
  try {
    screen = (await params.getDisplayMedia()).getVideoTracks()[0];
  } catch (error) {
    if (isRefusal(error)) return null;
    throw error;
  }
  if (!screen) return null;
  // Android's «Stop sharing» in the notification ends the track: give the camera back.
  screen.onended = params.onEnded;
  await sender.replaceTrack(screen);
  return { track: screen, camera, sender };
}

/** The camera back in its sender; stopping the screen ends the capture and its foreground service. */
export async function stopScreenShare(share: ScreenShare): Promise<void> {
  try {
    await share.sender.replaceTrack(share.camera);
  } finally {
    // Even with the call already closed (replaceTrack throws), the capture has to end.
    share.track.stop();
  }
}
