import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CallState } from '@lilachat/shared';
import { CallOverlay } from './CallOverlay';
import type { WebCall } from './useWebCall';

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
