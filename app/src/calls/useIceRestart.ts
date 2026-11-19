import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { RTCSessionDescription, type RTCPeerConnection } from 'react-native-webrtc';
import { CALL_RESTART, CALL_RESTART_ANSWER, createIceRestarter, type CallState, type RestartPeer } from '@lilachat/shared';
import { connectSocket, getSocket } from '../chat/socketClient';
import { registrarPerf } from '../diagnostico/diagnostico';
import { reportarError } from '../ui/reportarError';
import type { EstadoDeMedios } from './estadoDeMedios';

type CallRefs = {
  pcRef: MutableRefObject<RTCPeerConnection | null>;
  chatIdRef: MutableRefObject<string | null>;
  stateRef: MutableRefObject<CallState | null>;
};

/** The call's react-native-webrtc peer, as the shared restarter sees it. */
function restartPeerOf(pc: RTCPeerConnection): RestartPeer {
  return {
    signalingState: () => pc.signalingState,
    createRestartOffer: async () => {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      return offer.sdp;
    },
    answerOffer: async (sdp) => {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer.sdp;
    },
    setRemoteAnswer: (sdp) => pc.setRemoteDescription(new RTCSessionDescription(sdp)),
  };
}

/**
 * The call survives a lost media path (José 19/11: the call was cut when the phone
 * locked or he switched apps): the shared ICE restart (`shared/iceRestarter.ts`)
 * over this phone's peer and socket. The web runs the same one.
 */
export function useIceRestart(params: CallRefs & { jwt: string; medios: EstadoDeMedios }) {
  const { pcRef, chatIdRef, stateRef } = params;
  const mediosRef = useRef(params.medios);
  mediosRef.current = params.medios;
  const [restarter] = useState(() =>
    createIceRestarter({
      peer: () => (pcRef.current ? restartPeerOf(pcRef.current) : null),
      chatId: () => chatIdRef.current,
      state: () => stateRef.current,
      media: () => mediosRef.current,
      emit: (event, frame) => void getSocket()?.emit(event, frame),
      report: reportarError,
      measure: (op, ms, extra) => void registrarPerf(op, ms, extra),
    })
  );

  useEffect(() => {
    const socket = connectSocket(params.jwt);
    const { onRestartFrame, onAnswerFrame, onSocketBack } = restarter;
    socket.on(CALL_RESTART, onRestartFrame);
    socket.on(CALL_RESTART_ANSWER, onAnswerFrame);
    socket.on('connect', onSocketBack);
    return () => {
      socket.off(CALL_RESTART, onRestartFrame);
      socket.off(CALL_RESTART_ANSWER, onAnswerFrame);
      socket.off('connect', onSocketBack);
    };
  }, [params.jwt, restarter]);

  return { onIce: restarter.onIce, emitCandidate: restarter.emitCandidate, gaveUp: restarter.gaveUp };
}
