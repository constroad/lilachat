import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroupCallRoom } from '@lilachat/shared';
import { currentSocket } from '../../useSocket';
import { createCallPeer, fetchIceServers, mediaErrorText, type CallPeer, type Candidate, type Sdp } from '../callPeer';

type Signal = { chatId: string; from: string; kind: 'offer' | 'answer' | 'ice'; data: Sdp | Candidate };
type JoinAnswer = { ok: boolean; motivo?: string; peers?: string[]; room?: GroupCallRoom; names?: Record<string, string> };
export type GroupRing = { chatId: string; chatName?: string | null; from: string; fromName: string | null; video: boolean };
export type WebGroupCallState = { chatId: string; chatName: string; video: boolean; participants: string[]; startedAt: number | null };

const emit = (event: string, frame: object) => void currentSocket()?.emit(event, frame);

/**
 * A group call on the web (pending 56), like the phone's `useGroupCall`: one
 * peer per person, the newcomer offers to everyone already there, the others
 * only answer. One microphone (and camera) shared by every connection.
 */
export function useWebGroupCall(params: { jwt: string; me: string; connected: boolean }) {
  const [call, setCall] = useState<WebGroupCallState | null>(null);
  const [ring, setRing] = useState<GroupRing | null>(null);
  const [rooms, setRooms] = useState<ReadonlyMap<string, GroupCallRoom>>(new Map());
  const [names, setNames] = useState<Readonly<Record<string, string>>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [streams, setStreams] = useState<ReadonlyMap<string, MediaStream>>(new Map());
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const peers = useRef(new Map<string, CallPeer>());
  const iceServers = useRef<RTCIceServer[]>([]);
  const callRef = useRef<WebGroupCallState | null>(null);
  callRef.current = call;
  const localRef = useRef<MediaStream | null>(null);

  const dropPeer = useCallback((userId: string) => {
    peers.current.get(userId)?.close();
    peers.current.delete(userId);
    setStreams((current) => {
      const next = new Map(current);
      next.delete(userId);
      return next;
    });
  }, []);

  const cleanUp = useCallback(() => {
    for (const userId of [...peers.current.keys()]) dropPeer(userId);
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    setLocalStream(null);
    setMuted(false);
    setCameraOn(true);
    setCall(null);
  }, [dropPeer]);

  const peerFor = useCallback((userId: string): CallPeer => {
    const known = peers.current.get(userId);
    if (known) return known;
    const peer = createCallPeer({
      iceServers: iceServers.current,
      onCandidate: (candidate) => callRef.current && emit('groupcall.signal', { chatId: callRef.current.chatId, to: userId, kind: 'ice', data: candidate }),
      onRemoteStream: (stream) => setStreams((current) => new Map(current).set(userId, stream)),
      onIceState: () => undefined,
    });
    const local = localRef.current;
    local?.getTracks().forEach((track) => peer.connection.addTrack(track, local));
    peers.current.set(userId, peer);
    return peer;
  }, []);

  const onSignal = useCallback(async (signal: Signal) => {
    if (signal.chatId !== callRef.current?.chatId) return;
    const peer = peerFor(signal.from);
    if (signal.kind === 'ice') return peer.addCandidate(signal.data as Candidate);
    await peer.setRemote(signal.data as Sdp);
    if (signal.kind !== 'offer') return;
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    emit('groupcall.signal', { chatId: signal.chatId, to: signal.from, kind: 'answer', data: { type: 'answer', sdp: answer.sdp } });
  }, [peerFor]);

  // Read on every render, like `useWebCall`: a replaced socket brings its listeners back.
  const socket = currentSocket();
  useEffect(() => {
    if (!socket) return;
    const onState = (frame: { chatId: string; room: GroupCallRoom | null; names?: Record<string, string> }) => {
      if (frame.names) setNames((current) => ({ ...current, ...frame.names }));
      setRooms((current) => {
        const next = new Map(current);
        if (frame.room) next.set(frame.chatId, frame.room);
        else next.delete(frame.chatId);
        return next;
      });
      const room = frame.room;
      if (room && callRef.current?.chatId === frame.chatId) setCall((current) => (current ? { ...current, participants: room.participants, startedAt: room.startedAt } : current));
      if (!room) setRing((current) => (current?.chatId === frame.chatId ? null : current));
    };
    const onRing = (frame: GroupRing) => void (callRef.current || setRing(frame));
    const onLeft = (frame: { chatId: string; userId: string }) => void (frame.chatId === callRef.current?.chatId && dropPeer(frame.userId));
    const handleSignal = (frame: Signal) => onSignal(frame).catch((failure: unknown) => console.warn('[llamada grupal] señal:', failure));
    socket.on('groupcall.state', onState);
    socket.on('groupcall.ring', onRing);
    socket.on('groupcall.left', onLeft);
    socket.on('groupcall.signal', handleSignal);
    return () => {
      socket.off('groupcall.state', onState);
      socket.off('groupcall.ring', onRing);
      socket.off('groupcall.left', onLeft);
      socket.off('groupcall.signal', handleSignal);
    };
  }, [socket, params.connected, onSignal, dropPeer]);

  /** Start or join the group's call: the microphone (and camera), then an offer to each one already in it. */
  const join = useCallback(async (chatId: string, chatName: string, video: boolean) => {
    if (callRef.current) return;
    setRing(null);
    setError(null);
    try {
      iceServers.current = await fetchIceServers(params.jwt);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localRef.current = stream;
      setLocalStream(stream);
      setCameraOn(video && stream.getVideoTracks().length > 0);
      const pending: WebGroupCallState = { chatId, chatName, video, participants: [params.me], startedAt: null };
      callRef.current = pending;
      setCall(pending);
      const answer = await new Promise<JoinAnswer>((resolve) => currentSocket()?.emit('groupcall.join', { chatId, video }, resolve));
      if (!answer.ok) {
        cleanUp();
        setError(answer.motivo ?? 'No se pudo entrar a la llamada.');
        return;
      }
      if (answer.names) setNames((current) => ({ ...current, ...answer.names }));
      const joined: WebGroupCallState = { chatId, chatName, video: answer.room?.video ?? video, participants: answer.room?.participants ?? [params.me], startedAt: answer.room?.startedAt ?? Date.now() };
      callRef.current = joined;
      setCall(joined);
      for (const userId of answer.peers ?? []) {
        const peer = peerFor(userId);
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);
        emit('groupcall.signal', { chatId, to: userId, kind: 'offer', data: { type: 'offer', sdp: offer.sdp } });
      }
    } catch (failure) {
      cleanUp();
      setError(mediaErrorText(failure, video));
    }
  }, [params.jwt, params.me, peerFor, cleanUp]);

  const leave = useCallback(() => {
    if (callRef.current) emit('groupcall.leave', { chatId: callRef.current.chatId });
    cleanUp();
  }, [cleanUp]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOn;
    localRef.current?.getVideoTracks().forEach((track) => (track.enabled = next));
    setCameraOn(next);
  }, [cameraOn]);

  /** The room of a chat, asked when it opens (the strip «Unirse»). */
  const refreshRoom = useCallback((chatId: string) => {
    currentSocket()?.emit('groupcall.get', { chatId }, (answer: { room?: GroupCallRoom | null }) => {
      setRooms((current) => {
        const next = new Map(current);
        if (answer?.room) next.set(chatId, answer.room);
        else next.delete(chatId);
        return next;
      });
    });
  }, []);

  // Closing the tab or the session leaves the call (the server also drops the socket).
  useEffect(() => () => cleanUp(), [cleanUp]);

  return { call, ring, rooms, names, localStream, streams, muted, cameraOn, error, join, leave, toggleMute, toggleCamera, refreshRoom, ignoreRing: () => setRing(null), clearError: () => setError(null) };
}

export type WebGroupCall = ReturnType<typeof useWebGroupCall>;
