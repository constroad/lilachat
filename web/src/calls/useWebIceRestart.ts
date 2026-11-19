import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { CALL_RESTART, CALL_RESTART_ANSWER, createIceRestarter, type CallState, type MediaState, type RestartPeer } from '@lilachat/shared';
import { currentSocket } from '../useSocket';
import type { CallPeer } from './callPeer';

/** The browser's peer, as the shared restarter sees it. */
function restartPeerOf(connection: RTCPeerConnection): RestartPeer {
  return {
    signalingState: () => connection.signalingState,
    createRestartOffer: async () => {
      connection.restartIce?.();
      const offer = await connection.createOffer({ iceRestart: true });
      await connection.setLocalDescription(offer);
      return offer.sdp ?? '';
    },
    answerOffer: async (sdp) => {
      await connection.setRemoteDescription(sdp);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      return answer.sdp ?? '';
    },
    setRemoteAnswer: (sdp) => connection.setRemoteDescription(sdp),
  };
}

/**
 * The web side of the ICE restart (José 19/11: the call was cut when the phone locked or
 * he switched apps). The same controller as the APK (`shared/iceRestarter.ts`), so an
 * APK↔web call recovers whoever called: the caller restarts, the other side asks.
 */
export function useWebIceRestart(params: {
  peerRef: MutableRefObject<CallPeer | null>;
  chatId: () => string | null;
  stateRef: MutableRefObject<CallState | null>;
  media: MediaState;
  /** Read on every render, like the call's other signals: a replaced socket keeps the listeners. */
  connected: boolean;
}) {
  const { peerRef, stateRef } = params;
  const latest = useRef({ chatId: params.chatId, media: params.media });
  latest.current = { chatId: params.chatId, media: params.media };
  const [restarter] = useState(() =>
    createIceRestarter({
      peer: () => (peerRef.current ? restartPeerOf(peerRef.current.connection) : null),
      chatId: () => latest.current.chatId(),
      state: () => stateRef.current,
      media: () => latest.current.media,
      emit: (event, frame) => void currentSocket()?.emit(event, frame),
      report: (where, failure) => console.warn(`[llamada] ${where}:`, failure),
    })
  );

  const socket = currentSocket();
  useEffect(() => {
    if (!socket) return;
    const { onRestartFrame, onAnswerFrame, onSocketBack } = restarter;
    socket.on(CALL_RESTART, onRestartFrame);
    socket.on(CALL_RESTART_ANSWER, onAnswerFrame);
    socket.on('connect', onSocketBack);
    return () => {
      socket.off(CALL_RESTART, onRestartFrame);
      socket.off(CALL_RESTART_ANSWER, onAnswerFrame);
      socket.off('connect', onSocketBack);
    };
  }, [socket, params.connected, restarter]);

  return { onIce: restarter.onIce, emitCandidate: restarter.emitCandidate, gaveUp: restarter.gaveUp };
}
