import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, Vibration } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, type MediaStream } from 'react-native-webrtc';
import type RTCIceCandidateEvent from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent';
import type { GroupCallRoom } from '@lilachat/shared';
import { connectSocket, getSocket, sostenerPorLlamada } from '../../chat/socketClient';
import { obtenerIceServers, type ServidorIce } from '../iceServers';
import { reportarError } from '../../ui/reportarError';
import type { GroupRing } from './groupCallView';

type Sdp = { type: 'offer' | 'answer'; sdp: string };
type Candidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
type Signal = { chatId: string; from: string; kind: 'offer' | 'answer' | 'ice'; data: Sdp | Candidate };
type Peer = { pc: RTCPeerConnection; remoteReady: boolean; pending: Candidate[] };
export type GroupCallState = { chatId: string; chatName: string; video: boolean; participants: string[]; startedAt: number | null };

const RING_VIBRATION = [0, 600, 1400];

async function askPermissions(video: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const wanted = video ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA] : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  const granted = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

/**
 * A group call on the phone (pending 56, José 29/10): one peer connection per
 * person in the room (a mesh of up to four). Who joins offers to everyone
 * already there; the others only answer, so two phones never offer to each
 * other at once. The server only carries the signals; audio and video go
 * phone to phone, through the same TURN as the 1:1 call.
 */
export function useGroupCall(params: { jwt: string; me: string }) {
  const [call, setCall] = useState<GroupCallState | null>(null);
  const [ring, setRing] = useState<GroupRing | null>(null);
  const [rooms, setRooms] = useState<ReadonlyMap<string, GroupCallRoom>>(new Map());
  const [names, setNames] = useState<Readonly<Record<string, string>>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [streams, setStreams] = useState<ReadonlyMap<string, MediaStream>>(new Map());
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const peers = useRef(new Map<string, Peer>());
  const iceServers = useRef<ServidorIce[]>([]);
  const callRef = useRef<GroupCallState | null>(null);
  callRef.current = call;
  const localRef = useRef<MediaStream | null>(null);

  const dropPeer = useCallback((userId: string) => {
    peers.current.get(userId)?.pc.close();
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
    sostenerPorLlamada(false);
  }, [dropPeer]);

  const peerFor = useCallback((userId: string): Peer => {
    const known = peers.current.get(userId);
    if (known) return known;
    const pc = new RTCPeerConnection({ iceServers: iceServers.current });
    const peer: Peer = { pc, remoteReady: false, pending: [] };
    pc.onicecandidate = (event: RTCIceCandidateEvent<'icecandidate'>) => {
      const candidate = event.candidate;
      if (!candidate || !callRef.current) return;
      getSocket()?.emit('groupcall.signal', { chatId: callRef.current.chatId, to: userId, kind: 'ice', data: { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex } });
    };
    pc.ontrack = (event: RTCTrackEvent<'track'>) => {
      const stream = event.streams[0];
      if (stream) setStreams((current) => new Map(current).set(userId, stream));
    };
    localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current!));
    peers.current.set(userId, peer);
    return peer;
  }, []);

  const drain = useCallback(async (peer: Peer) => {
    peer.remoteReady = true;
    for (const candidate of peer.pending) await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((error: unknown) => reportarError('groupcall.ice', error));
    peer.pending = [];
  }, []);

  const onSignal = useCallback(async (signal: Signal) => {
    if (signal.chatId !== callRef.current?.chatId) return;
    const peer = peerFor(signal.from);
    if (signal.kind === 'ice') {
      if (peer.remoteReady) await peer.pc.addIceCandidate(new RTCIceCandidate(signal.data as Candidate)).catch((error: unknown) => reportarError('groupcall.ice', error));
      else peer.pending.push(signal.data as Candidate);
      return;
    }
    await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.data as Sdp));
    await drain(peer);
    if (signal.kind !== 'offer') return;
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    getSocket()?.emit('groupcall.signal', { chatId: signal.chatId, to: signal.from, kind: 'answer', data: { type: 'answer', sdp: answer.sdp } });
  }, [peerFor, drain]);

  useEffect(() => {
    const socket = connectSocket(params.jwt);
    const onState = (frame: { chatId: string; room: GroupCallRoom | null; names?: Record<string, string> }) => {
      if (frame.names) setNames((current) => ({ ...current, ...frame.names }));
      setRooms((current) => {
        const next = new Map(current);
        if (frame.room) next.set(frame.chatId, frame.room);
        else next.delete(frame.chatId);
        return next;
      });
      if (callRef.current?.chatId === frame.chatId && frame.room) setCall((current) => (current ? { ...current, participants: frame.room!.participants, startedAt: frame.room!.startedAt } : current));
      if (!frame.room) setRing((current) => (current?.chatId === frame.chatId ? null : current));
    };
    const onRing = (frame: GroupRing) => {
      if (callRef.current) return;
      setRing(frame);
      Vibration.vibrate(RING_VIBRATION);
    };
    const onLeft = (frame: { chatId: string; userId: string }) => {
      if (frame.chatId === callRef.current?.chatId) dropPeer(frame.userId);
    };
    const handleSignal = (frame: Signal) => void onSignal(frame).catch((error: unknown) => reportarError('groupcall.signal', error));
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
  }, [params.jwt, onSignal, dropPeer]);

  /** Start or join the group's call: the camera and mic, then an offer to each one already in it. */
  const join = useCallback(async (chatId: string, chatName: string, video: boolean) => {
    if (callRef.current) return;
    setRing(null);
    Vibration.cancel();
    if (!(await askPermissions(video))) return Alert.alert('Llamada grupal', video ? 'Permite el micrófono y la cámara para la videollamada.' : 'Permite el micrófono para la llamada.');
    try {
      iceServers.current = await obtenerIceServers(params.jwt);
      const stream = await mediaDevices.getUserMedia({ audio: true, video });
      localRef.current = stream;
      setLocalStream(stream);
      setCameraOn(video);
      sostenerPorLlamada(true);
      void setAudioModeAsync({ shouldRouteThroughEarpiece: false }).catch((error: unknown) => reportarError('groupcall.audio', error));
      setCall({ chatId, chatName, video, participants: [params.me], startedAt: null });
      const answer = await new Promise<{ ok: boolean; motivo?: string; peers?: string[]; room?: GroupCallRoom; names?: Record<string, string> }>((resolve) => connectSocket(params.jwt).emit('groupcall.join', { chatId, video }, resolve));
      if (!answer.ok) {
        cleanUp();
        return Alert.alert('Llamada grupal', answer.motivo ?? 'No se pudo entrar a la llamada.');
      }
      if (answer.names) setNames((current) => ({ ...current, ...answer.names }));
      setCall({ chatId, chatName, video: answer.room?.video ?? video, participants: answer.room?.participants ?? [params.me], startedAt: answer.room?.startedAt ?? Date.now() });
      for (const userId of answer.peers ?? []) {
        const peer = peerFor(userId);
        const offer = await peer.pc.createOffer({});
        await peer.pc.setLocalDescription(offer);
        getSocket()?.emit('groupcall.signal', { chatId, to: userId, kind: 'offer', data: { type: 'offer', sdp: offer.sdp } });
      }
    } catch (error) {
      reportarError('groupcall.join', error);
      cleanUp();
      Alert.alert('Llamada grupal', 'No se pudo abrir el micrófono o la cámara.');
    }
  }, [params.jwt, params.me, peerFor, cleanUp]);

  const leave = useCallback(() => {
    const current = callRef.current;
    if (current) getSocket()?.emit('groupcall.leave', { chatId: current.chatId });
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

  /** The room of a chat, asked once when it opens (the strip «Unirse»). */
  const refreshRoom = useCallback((chatId: string) => {
    connectSocket(params.jwt).emit('groupcall.get', { chatId }, (answer: { room?: GroupCallRoom | null }) => {
      setRooms((current) => {
        const next = new Map(current);
        if (answer?.room) next.set(chatId, answer.room);
        else next.delete(chatId);
        return next;
      });
    });
  }, [params.jwt]);

  const ignoreRing = useCallback(() => {
    Vibration.cancel();
    setRing(null);
  }, []);

  useEffect(() => () => cleanUp(), [cleanUp]);

  return { call, ring, rooms, names, localStream, streams, muted, cameraOn, join, leave, toggleMute, toggleCamera, refreshRoom, ignoreRing };
}

export type GroupCall = ReturnType<typeof useGroupCall>;
