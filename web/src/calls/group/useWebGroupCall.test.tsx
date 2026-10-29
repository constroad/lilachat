import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useWebGroupCall } from './useWebGroupCall';

/** Pending 56 (José, 29/10): the web joins a group call as one more phone of the mesh. */
type Handler = (frame: never) => unknown;
const sent: { event: string; frame: Record<string, unknown> }[] = [];
const handlers = new Map<string, Handler>();
let joinAnswer: Record<string, unknown> = {};
const socket = {
  on: (event: string, handler: Handler) => void handlers.set(event, handler),
  off: (event: string) => void handlers.delete(event),
  emit: (event: string, frame: Record<string, unknown>, ack?: (answer: unknown) => void) => {
    sent.push({ event, frame });
    if (event === 'groupcall.join') ack?.(joinAnswer);
  },
};
vi.mock('../../useSocket', () => ({ currentSocket: () => socket }));
vi.mock('../callPeer', async (original) => ({ ...(await original<typeof import('../callPeer')>()), fetchIceServers: async () => [] }));

class FakePeer {
  static all: FakePeer[] = [];
  remote: unknown = null;
  tracks: unknown[] = [];
  closed = false;
  onicecandidate: ((event: unknown) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  iceConnectionState = 'new';
  constructor() {
    FakePeer.all.push(this);
  }
  async setRemoteDescription(description: unknown) {
    this.remote = description;
  }
  async setLocalDescription() {}
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' };
  }
  async addIceCandidate() {}
  addTrack(track: unknown) {
    this.tracks.push(track);
  }
  close() {
    this.closed = true;
  }
}

const track = { kind: 'audio', enabled: true, stop: vi.fn() };
const signals = () => sent.filter((one) => one.event === 'groupcall.signal').map((one) => one.frame);

beforeEach(() => {
  sent.length = 0;
  handlers.clear();
  FakePeer.all = [];
  vi.stubGlobal('RTCPeerConnection', FakePeer);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] }) } });
  joinAnswer = { ok: true, peers: ['a'], room: { chatId: 'g1', video: false, startedAt: 1, participants: ['a', 'me'] }, names: { a: 'Ana' } };
});
afterEach(() => vi.unstubAllGlobals());

describe('useWebGroupCall', () => {
  it('joining offers to each one already in the room, with the microphone in each connection', async () => {
    // Arrange
    const { result } = renderHook(() => useWebGroupCall({ jwt: 'jwt', me: 'me', connected: true }));
    // Act
    await act(() => result.current.join('g1', 'Obra', false));
    // Assert
    expect(sent[0]).toEqual({ event: 'groupcall.join', frame: { chatId: 'g1', video: false } });
    await waitFor(() => expect(signals()).toEqual([{ chatId: 'g1', to: 'a', kind: 'offer', data: { type: 'offer', sdp: 'offer-sdp' } }]));
    expect(FakePeer.all[0]!.tracks).toEqual([track]);
    expect(result.current.call).toMatchObject({ chatId: 'g1', participants: ['a', 'me'] });
    expect(result.current.names).toMatchObject({ a: 'Ana' });
  });

  it('answers who joins after me, and drops them when they leave', async () => {
    // Arrange
    joinAnswer = { ok: true, peers: [], room: { chatId: 'g1', video: false, startedAt: 1, participants: ['me'] }, names: {} };
    const { result } = renderHook(() => useWebGroupCall({ jwt: 'jwt', me: 'me', connected: true }));
    await act(() => result.current.join('g1', 'Obra', false));
    // Act
    await act(async () => void (await (handlers.get('groupcall.signal') as (frame: unknown) => Promise<void>)({ chatId: 'g1', from: 'b', kind: 'offer', data: { type: 'offer', sdp: 'x' } })));
    // Assert
    await waitFor(() => expect(signals()).toEqual([{ chatId: 'g1', to: 'b', kind: 'answer', data: { type: 'answer', sdp: 'answer-sdp' } }]));
    act(() => void (handlers.get('groupcall.left') as (frame: unknown) => void)({ chatId: 'g1', userId: 'b' }));
    expect(FakePeer.all[0]!.closed).toBe(true);
  });

  it('a refused join closes the microphone and says why', async () => {
    joinAnswer = { ok: false, motivo: 'La llamada está llena (4 personas).' };
    const { result } = renderHook(() => useWebGroupCall({ jwt: 'jwt', me: 'me', connected: true }));
    await act(() => result.current.join('g1', 'Obra', false));
    expect(result.current.call).toBeNull();
    expect(result.current.error).toBe('La llamada está llena (4 personas).');
    expect(track.stop).toHaveBeenCalled();
  });
});
