import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CallState } from '@lilachat/shared';
import { CallOverlay } from './CallOverlay';
import type { WebCall } from './useWebCall';

type Handler = (frame: unknown) => void;
const socketHandlers = new Map<string, Handler>();
const emitted: { event: string; frame: unknown }[] = [];
const socket = { on: (event: string, handler: Handler) => void socketHandlers.set(event, handler), off: (event: string) => void socketHandlers.delete(event), emit: (event: string, frame: unknown) => void emitted.push({ event, frame }) };
vi.mock('../useSocket', () => ({ currentSocket: () => socket }));

const stream = (video: boolean) => ({ getVideoTracks: () => (video ? [{}] : []), getAudioTracks: () => [{}] }) as unknown as MediaStream;
const since = 1_000_000;
const ringing: CallState = { fase: 'sonando', desde: since, entrante: true };
const active: CallState = { fase: 'activa', desde: since, entrante: true, conectadaEn: since };

function callWith(change: Partial<WebCall>): WebCall {
  return {
    state: ringing,
    session: { chatId: 'c1', peerName: 'José', videoCall: true },
    media: 'conectada',
    muted: false,
    cameraOn: false,
    localStream: null,
    remoteStream: null,
    error: null,
    call: vi.fn(),
    answer: vi.fn(),
    hangUp: vi.fn(),
    close: vi.fn(),
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    ...change,
  } as WebCall;
}

// jsdom has no Web Animations: the wink and the sticker only need a handle.
Element.prototype.animate = function animate() {
  return { cancel: () => undefined, finish: () => undefined, finished: new Promise(() => undefined), onfinish: null } as unknown as Animation;
};

afterEach(cleanup);

/** The call window on the web (José, 21/10). */
describe('call window', () => {
  it('the other video that arrived while ringing shows once answered (it was black in the E2E)', () => {
    const remote = stream(true);
    const { rerender, container } = render(<CallOverlay call={callWith({ remoteStream: remote })} />);
    expect(container.querySelector('video')).toBeNull();
    rerender(<CallOverlay call={callWith({ state: active, remoteStream: remote, localStream: stream(false) })} />);
    const remoteVideo = container.querySelector('video') as HTMLVideoElement & { srcObject: unknown };
    expect(remoteVideo.srcObject).toBe(remote);
  });

  it('ringing offers decline and answer; answering calls it', () => {
    const call = callWith({});
    render(<CallOverlay call={call} />);
    expect(screen.getByTestId('leyenda-llamada').textContent).toBe('Videollamada entrante');
    fireEvent.click(screen.getByTestId('btn-contestar-llamada'));
    expect(call.answer).toHaveBeenCalled();
  });

  it('without a camera of mine there is no camera button; an error is said instead of the clock', () => {
    render(<CallOverlay call={callWith({ state: active, localStream: stream(false), error: 'Permite el micrófono en el navegador para llamar.' })} />);
    expect(screen.queryByTestId('btn-camara')).toBeNull();
    expect(screen.getByTestId('leyenda-llamada').textContent).toBe('Permite el micrófono en el navegador para llamar.');
  });
});

describe('winks and stickers during the call (pending 98)', () => {
  it('sends a pack sticker to the other side and plays it here; the other\'s wink plays too; none while ringing', async () => {
    // Arrange
    const { STICKER_PACK_SECTIONS } = await import('../chat/stickers/useStickers');
    const sticker = STICKER_PACK_SECTIONS[0]!.stickers[0]!;
    const { rerender } = render(<CallOverlay call={callWith({})} />);
    expect(screen.queryByTestId('btn-reacciones-llamada')).toBeNull();
    rerender(<CallOverlay call={callWith({ state: active, localStream: stream(true) })} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-reacciones-llamada'));
    fireEvent.click(screen.getByTestId('reacciones-stickers'));
    fireEvent.click(screen.getByTestId(`sticker-llamada-${sticker.id}`));
    // Assert
    expect(emitted.at(-1)).toEqual({ event: 'call.reaction', frame: { chatId: 'c1', reaction: { kind: 'sticker', id: sticker.id } } });
    expect(screen.getByTestId(`sticker-en-llamada-${sticker.id}`)).toBeInTheDocument();
    act(() => socketHandlers.get('call.reaction')?.({ chatId: 'c1', reaction: { kind: 'wink', id: 'hearts' } }));
    expect(screen.getByTestId('guino-en-pantalla-hearts')).toBeInTheDocument();
  });
});
