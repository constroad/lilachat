import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useWebCall } from './useWebCall';

type Handler = (frame: never) => unknown;
const sent: { event: string; frame: Record<string, unknown> }[] = [];
const handlers = new Map<string, Handler>();
const socket = {
  on: (event: string, handler: Handler) => void handlers.set(event, handler),
  off: (event: string) => void handlers.delete(event),
  emit: (event: string, frame: Record<string, unknown>) => void sent.push({ event, frame }),
};
vi.mock('../useSocket', () => ({ currentSocket: () => socket }));

/** The browser's RTCPeerConnection, as small as the hook needs it. */
class FakePeer {
  static last: FakePeer;
  static senders: unknown[] = [];
  iceConnectionState = 'new';
  remote: unknown = null;
  local: unknown = null;
  applied: unknown[] = [];
  tracks: unknown[] = [];
  closed = false;
  onicecandidate: ((event: unknown) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  constructor() {
    FakePeer.last = this;
  }
  async setRemoteDescription(description: unknown) {
    this.remote = description;
  }
  async setLocalDescription(description: unknown) {
    this.local = description;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' };
  }
  async addIceCandidate(candidate: unknown) {
    if (!this.remote) throw new Error('remote description not set');
    this.applied.push(candidate);
  }
  addTrack(track: unknown) {
    this.tracks.push(track);
  }
  getSenders() {
    return FakePeer.senders;
  }
  close() {
    this.closed = true;
  }
  ice(state: string) {
    this.iceConnectionState = state;
    this.oniceconnectionstatechange?.();
  }
}

const track = () => ({ stop: vi.fn(), enabled: true });
let tracks: ReturnType<typeof track>[] = [];
const getUserMedia = vi.fn();
const receive = (event: string, frame: object) => act(async () => void (await handlers.get(event)?.(frame as never)));
const lastSent = (event: string) => sent.filter((one) => one.event === event).at(-1)?.frame;
const candidate = { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 };

beforeEach(() => {
  sent.length = 0;
  tracks = [track(), track()];
  getUserMedia.mockReset().mockImplementation(async (constraints: { video: boolean }) => ({
    getTracks: () => (constraints.video ? tracks : tracks.slice(0, 1)),
    getAudioTracks: () => tracks.slice(0, 1),
    getVideoTracks: () => (constraints.video ? tracks.slice(1) : []),
  }));
  vi.stubGlobal('RTCPeerConnection', FakePeer);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ iceServers: [{ urls: 'turn:x', username: 'u', credential: 'c' }] }), { status: 200 }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mount = () => renderHook(() => useWebCall({ jwt: 'jwt', connected: true, nameOf: (offer) => offer.fromName ?? 'Alguien' }));

/** José, 21/10: make and answer calls on the web, with the app's same signaling. */
describe('web call', () => {
  it('calls: the offer goes out, the answer connects it, the audio flows, and hanging up releases the microphone', async () => {
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', false));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(lastSent('call.offer')).toEqual({ chatId: 'c1', video: false, sdp: { type: 'offer', sdp: 'offer-sdp' } });
    expect(result.current.state?.fase).toBe('llamando');
    await receive('call.answer', { chatId: 'c1', sdp: { type: 'answer', sdp: 'their-answer' } });
    expect(result.current.state?.fase).toBe('activa');
    expect(FakePeer.last.remote).toEqual({ type: 'answer', sdp: 'their-answer' });
    act(() => FakePeer.last.ice('connected'));
    expect(result.current.media).toBe('conectada');
    act(() => result.current.hangUp());
    expect(lastSent('call.end')).toEqual({ chatId: 'c1', motivo: 'colgada' });
    expect(result.current.state).toMatchObject({ fase: 'terminada', motivo: 'colgada', porMi: true });
    await waitFor(() => expect(FakePeer.last.closed).toBe(true));
    expect(tracks[0]?.stop).toHaveBeenCalled();
  });

  it('rings with who calls; a candidate that came before the peer is applied; answering sends the answer', async () => {
    const { result } = mount();
    // The candidate arrives while the peer waits for its ICE servers.
    await act(async () => {
      const ringing = handlers.get('call.offer')?.({ chatId: 'c2', video: true, fromName: 'Beto', sdp: { type: 'offer', sdp: 'their-offer' } } as never);
      handlers.get('call.ice')?.({ chatId: 'c2', candidate } as never);
      await ringing;
    });
    expect(result.current.state).toMatchObject({ fase: 'sonando', entrante: true });
    expect(result.current.session).toEqual({ chatId: 'c2', peerName: 'Beto', videoCall: true });
    await waitFor(() => expect(FakePeer.last.applied).toEqual([candidate]));
    await act(() => result.current.answer());
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(lastSent('call.answer')).toEqual({ chatId: 'c2', sdp: { type: 'answer', sdp: 'answer-sdp' } });
    expect(result.current.state?.fase).toBe('activa');
  });

  /** Backlog 114: the other phone tapped «Contestar» on its lock screen; the ring no longer runs out. */
  it('the caller hears «answering» and waits past the 30 s ring; the callee says it before its microphone', async () => {
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', false));
    await receive('call.answering', { chatId: 'c1', from: 'ana' });
    expect(result.current.state).toMatchObject({ fase: 'llamando' });
    expect(result.current.state && 'answeringAt' in result.current.state && typeof result.current.state.answeringAt).toBe('number');
    await receive('call.answering', { chatId: 'other', from: 'x' });
    act(() => result.current.hangUp());

    const callee = mount();
    await receive('call.offer', { chatId: 'c3', video: false, fromName: 'Beto', sdp: { type: 'offer', sdp: 'their-offer' } });
    await act(() => callee.result.current.answer());
    const order = sent.map((one) => one.event);
    expect(order.indexOf('call.answering')).toBeGreaterThan(-1);
    expect(order.indexOf('call.answering')).toBeLessThan(order.indexOf('call.answer'));
    expect(lastSent('call.answering')).toEqual({ chatId: 'c3' });
  });

  it('another call while in one gets «busy», and the one in course goes on', async () => {
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', false));
    await receive('call.offer', { chatId: 'c9', fromName: 'Otro' });
    expect(lastSent('call.reject')).toEqual({ chatId: 'c9', motivo: 'ocupado' });
    expect(result.current.session?.chatId).toBe('c1');
  });

  it('the other hangs up, or is busy: it ends, and says why', async () => {
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', false));
    await receive('call.reject', { chatId: 'c1', motivo: 'ocupado' });
    expect(result.current.state).toMatchObject({ fase: 'terminada', motivo: 'ocupado' });
    act(() => result.current.close());
    await act(() => result.current.call('c1', 'Ana', false));
    await receive('call.end', { chatId: 'c1', motivo: 'colgada' });
    expect(result.current.state).toMatchObject({ fase: 'terminada', motivo: 'colgada', porMi: false });
  });

  it('without the microphone it says what to do and tells the other to stop', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', false));
    expect(result.current.error).toBe('Permite el micrófono en el navegador para llamar.');
    expect(lastSent('call.end')).toEqual({ chatId: 'c1', motivo: 'colgada' });
    expect(result.current.state?.fase).toBe('terminada');
    expect(lastSent('call.offer')).toBeUndefined();
  });

  it('declining an incoming call is «rejected», not «hung up»', async () => {
    const { result } = mount();
    await receive('call.offer', { chatId: 'c2', fromName: 'Beto', sdp: { type: 'offer', sdp: 'x' } });
    act(() => result.current.hangUp());
    expect(result.current.state).toMatchObject({ fase: 'terminada', motivo: 'rechazada' });
    expect(lastSent('call.end')).toEqual({ chatId: 'c2', motivo: 'colgada' });
  });
});

describe('web call without a camera', () => {
  it('a video call goes on with the voice, still receiving the other video, and there is no camera button to toggle', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('no camera', 'NotFoundError'));
    const addTransceiver = vi.fn();
    vi.stubGlobal('RTCPeerConnection', class extends FakePeer {
      addTransceiver = addTransceiver;
    });
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', true));
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true, video: false });
    expect(addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' });
    expect(lastSent('call.offer')).toMatchObject({ chatId: 'c1', video: true });
    expect(result.current.error).toBeNull();
  });
});

describe('switching the camera in a video call (pending 97)', () => {
  it('a phone with two cameras gets the switch; the rear track replaces the front one in the same sender and the old one stops', async () => {
    // Arrange
    const local = { video: [] as { stop: ReturnType<typeof vi.fn>; enabled: boolean; kind: string }[] };
    const front = { stop: vi.fn(), enabled: true, kind: 'video' };
    const rear = { stop: vi.fn(), enabled: true, kind: 'video' };
    local.video = [front];
    const replaceTrack = vi.fn(async () => undefined);
    FakePeer.senders = [{ get track() { return local.video[0]; }, replaceTrack }];
    getUserMedia.mockReset().mockImplementation(async (constraints: { audio: boolean; video: unknown }) =>
      constraints.audio
        ? { getTracks: () => [tracks[0], ...local.video], getAudioTracks: () => tracks.slice(0, 1), getVideoTracks: () => local.video, removeTrack: (one: unknown) => (local.video = local.video.filter((track) => track !== one)), addTrack: (one: typeof rear) => local.video.push(one) }
        : { getVideoTracks: () => [rear] }
    );
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia, enumerateDevices: async () => [{ kind: 'videoinput' }, { kind: 'videoinput' }, { kind: 'audioinput' }] }, configurable: true });
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', true));
    await waitFor(() => expect(result.current.canSwitch).toBe(true));
    // Act
    await act(() => result.current.switchCamera());
    // Assert
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: { facingMode: { exact: 'environment' } } });
    expect(replaceTrack).toHaveBeenCalledWith(rear);
    expect(front.stop).toHaveBeenCalled();
    expect(local.video).toEqual([rear]);
    expect(result.current.facing).toBe('environment');
  });

  it('a laptop with one camera gets no switch', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia, enumerateDevices: async () => [{ kind: 'videoinput' }] }, configurable: true });
    const { result } = mount();
    await act(() => result.current.call('c1', 'Ana', true));
    await waitFor(() => expect(result.current.localStream).not.toBeNull());
    expect(result.current.canSwitch).toBe(false);
    expect(result.current.facing).toBe('user');
  });
});
