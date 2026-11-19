import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { RTCSessionDescription, type RTCPeerConnection } from 'react-native-webrtc';
import {
  CALL_RESTART,
  CALL_RESTART_ANSWER,
  answersCurrentRestart,
  canOfferRestart,
  crearColaSerial,
  iceRecoveryOn,
  recoveryOnReconnect,
  restartFrameOf,
  type CallState,
  type IceRecovery,
  type RestartFrame,
} from '@lilachat/shared';
import { connectSocket, getSocket } from '../chat/socketClient';
import { registrarPerf } from '../diagnostico/diagnostico';
import { reportarError } from '../ui/reportarError';
import type { EstadoDeMedios } from './estadoDeMedios';

/** A candidate as it travels by the socket. */
export type OutgoingCandidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };

type CallRefs = {
  pcRef: MutableRefObject<RTCPeerConnection | null>;
  chatIdRef: MutableRefObject<string | null>;
  stateRef: MutableRefObject<CallState | null>;
};

const isCaller = (state: CallState | null): boolean => state?.entrante === false;
const isActive = (state: CallState | null): boolean => state?.fase === 'activa';

/**
 * The call survives a lost media path (José 19/11: the call was cut when the phone
 * locked or he switched apps). Locking the phone or leaving the app can change
 * or sleep its network; ICE stayed on the dead path and the call hung up. Now the
 * caller restarts ICE over the socket (`call.restart`, `shared/callRecovery.ts`), the
 * other side answers, and the call goes on through «Reconectando…».
 *
 * Candidates wait while a restart offer or answer is being set: sent before it, the
 * other side would try them against the old ICE credentials and drop them.
 */
export function useIceRestart(params: CallRefs & { jwt: string; medios: EstadoDeMedios }) {
  const { pcRef, chatIdRef, stateRef } = params;
  const mediosRef = useRef(params.medios);
  mediosRef.current = params.medios;
  const restartId = useRef(0);
  const lostAt = useRef<number | null>(null);
  const holding = useRef<OutgoingCandidate[] | null>(null);
  const [inOrder] = useState(crearColaSerial);

  const emitCandidate = useCallback((candidate: OutgoingCandidate) => {
    if (holding.current) holding.current.push(candidate);
    else getSocket()?.emit('call.ice', { chatId: chatIdRef.current, candidate });
  }, [chatIdRef]);

  /** Holds the candidates while `step` sets a description, then sends them after its frame. */
  const holdingCandidates = useCallback(async (step: () => Promise<void>) => {
    holding.current = [];
    try {
      await step();
    } finally {
      const held = holding.current ?? [];
      holding.current = null;
      held.forEach(emitCandidate);
    }
  }, [emitCandidate]);

  const offerRestart = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !canOfferRestart(pc.signalingState)) return;
    restartId.current += 1;
    const id = restartId.current;
    await holdingCandidates(async () => {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      getSocket()?.emit(CALL_RESTART, { chatId: chatIdRef.current, restartId: id, sdp: { type: 'offer', sdp: offer.sdp } });
    });
  }, [pcRef, chatIdRef, holdingCandidates]);

  const recover = useCallback((action: IceRecovery) => {
    if (action === 'none') return;
    lostAt.current ??= Date.now();
    if (action === 'ask-restart') return void getSocket()?.emit(CALL_RESTART, { chatId: chatIdRef.current });
    void inOrder(offerRestart).catch((error) => reportarError('call.restart', error));
  }, [chatIdRef, inOrder, offerRestart]);

  /** Called with every ICE state of the call's peer. */
  const onIce = useCallback((ice: string, connectedBefore: boolean) => {
    if ((ice === 'connected' || ice === 'completed') && lostAt.current !== null) {
      // Evidence for the next report: how long the call was lost and how many restarts it took.
      void registrarPerf('llamada-reconectada', Date.now() - lostAt.current, { reinicios: restartId.current });
      lostAt.current = null;
    }
    recover(iceRecoveryOn({ ice, connectedBefore, caller: isCaller(stateRef.current) }));
  }, [recover, stateRef]);

  /** The call gave up: how long it had been lost, in the diagnostic. */
  const gaveUp = useCallback(() => {
    if (lostAt.current !== null) void registrarPerf('llamada-perdida-sin-red', Date.now() - lostAt.current, { reinicios: restartId.current });
    lostAt.current = null;
    restartId.current = 0;
  }, []);

  useRestartSignals({ jwt: params.jwt, refs: { pcRef, chatIdRef, stateRef }, mediosRef, inOrder, recover, holdingCandidates, restartId });

  return { onIce, emitCandidate, gaveUp };
}

type SignalParams = {
  jwt: string;
  refs: CallRefs;
  mediosRef: MutableRefObject<EstadoDeMedios>;
  inOrder: ReturnType<typeof crearColaSerial>;
  recover: (action: IceRecovery) => void;
  holdingCandidates: (step: () => Promise<void>) => Promise<void>;
  restartId: MutableRefObject<number>;
};

/** The other side's restart frames, and the socket coming back while the call reconnects. */
function useRestartSignals(params: SignalParams): void {
  const latest = useRef(params);
  latest.current = params;
  useEffect(() => {
    const socket = connectSocket(params.jwt);
    const onRestart = (frame: unknown) => void latest.current.inOrder(() => handleRestart(latest.current, restartFrameOf(frame, CALL_RESTART))).catch((error) => reportarError('call.restart.offer', error));
    const onAnswer = (frame: unknown) => void latest.current.inOrder(() => handleAnswer(latest.current, restartFrameOf(frame, CALL_RESTART_ANSWER))).catch((error) => reportarError('call.restart.answer', error));
    const onConnect = () => {
      const { refs, mediosRef, recover } = latest.current;
      recover(recoveryOnReconnect({ active: isActive(refs.stateRef.current), media: mediosRef.current, caller: isCaller(refs.stateRef.current) }));
    };
    socket.on(CALL_RESTART, onRestart);
    socket.on(CALL_RESTART_ANSWER, onAnswer);
    socket.on('connect', onConnect);
    return () => {
      socket.off(CALL_RESTART, onRestart);
      socket.off(CALL_RESTART_ANSWER, onAnswer);
      socket.off('connect', onConnect);
    };
  }, [params.jwt]);
}

const ofThisCall = (refs: CallRefs, frame: RestartFrame | null): frame is RestartFrame =>
  frame !== null && frame.chatId === refs.chatIdRef.current && isActive(refs.stateRef.current);

/** The caller restarts when asked; the one who answered sets the new offer and answers it. */
async function handleRestart(params: SignalParams, frame: RestartFrame | null): Promise<void> {
  const { refs } = params;
  if (!ofThisCall(refs, frame)) return;
  const caller = isCaller(refs.stateRef.current);
  if (!frame.sdp) return caller ? params.recover('restart') : undefined;
  const pc = refs.pcRef.current;
  if (caller || !pc || pc.signalingState !== 'stable') return;
  const offer = frame.sdp;
  await params.holdingCandidates(async () => {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    getSocket()?.emit(CALL_RESTART_ANSWER, { chatId: frame.chatId, restartId: frame.restartId, sdp: { type: 'answer', sdp: answer.sdp } });
  });
}

/** Only the answer to the last restart offer: a late one would pair old credentials. */
async function handleAnswer(params: SignalParams, frame: RestartFrame | null): Promise<void> {
  const pc = params.refs.pcRef.current;
  if (!ofThisCall(params.refs, frame) || !frame.sdp || !pc) return;
  if (!answersCurrentRestart({ answerId: frame.restartId, currentId: params.restartId.current, signalingState: pc.signalingState })) return;
  await pc.setRemoteDescription(new RTCSessionDescription(frame.sdp));
}
