import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { mediaDevices, type MediaStream, type RTCPeerConnection } from 'react-native-webrtc';
import { reportarError } from '../ui/reportarError';
import { startScreenShare, stopScreenShare, type ScreenShare } from './screenShare';

/** «Compartir pantalla» of a call (APK 0.1.175): toggled from «Más opciones», and it ends with the call. */
export function useScreenShare(pcRef: MutableRefObject<RTCPeerConnection | null>, localRef: MutableRefObject<MediaStream | null>, live: boolean) {
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<ScreenShare | null>(null);
  const stop = useCallback(async () => {
    const share = shareRef.current;
    shareRef.current = null;
    setSharing(false);
    if (share) await stopScreenShare(share).catch((error) => reportarError('call.pantalla', error));
  }, []);
  useEffect(() => {
    if (!live) void stop();
  }, [live, stop]);
  const toggle = useCallback(async () => {
    if (shareRef.current) return stop();
    if (!pcRef.current || !localRef.current) return;
    try {
      shareRef.current = await startScreenShare({ pc: pcRef.current, stream: localRef.current, getDisplayMedia: () => mediaDevices.getDisplayMedia({}), onEnded: () => void stop() });
      setSharing(Boolean(shareRef.current));
    } catch (error) {
      reportarError('call.pantalla', error);
    }
  }, [pcRef, localRef, stop]);
  return { sharing, toggle };
}
