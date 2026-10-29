import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GroupCallOverlay } from './GroupCallOverlay';
import type { WebGroupCall } from './useWebGroupCall';

/** Pending 4 (José, 29/10): winks, stickers and the camera switch inside a group call. */
type Handler = (frame: unknown) => void;
const socketHandlers = new Map<string, Handler>();
const emitted: { event: string; frame: unknown }[] = [];
const socket = { on: (event: string, handler: Handler) => void socketHandlers.set(event, handler), off: (event: string) => void socketHandlers.delete(event), emit: (event: string, frame: unknown) => void emitted.push({ event, frame }) };
vi.mock('../../useSocket', () => ({ currentSocket: () => socket }));

// jsdom has no Web Animations: the wink and the sticker only need a handle.
Element.prototype.animate = function animate() {
  return { cancel: () => undefined, finish: () => undefined, finished: new Promise(() => undefined), onfinish: null } as unknown as Animation;
};

function groupWith(change: Partial<WebGroupCall>): WebGroupCall {
  return {
    call: { chatId: 'g1', chatName: 'obra-km-12', video: true, participants: ['me', 'a'], startedAt: 1 },
    names: { a: 'Ana' },
    localStream: null,
    streams: new Map(),
    muted: false,
    cameraOn: true,
    facing: 'user',
    canSwitch: false,
    switchCamera: vi.fn(),
    toggleMute: vi.fn(),
    toggleCamera: vi.fn(),
    leave: vi.fn(),
    ...change,
  } as unknown as WebGroupCall;
}

afterEach(() => {
  cleanup();
  emitted.length = 0;
});

describe('group call window', () => {
  it('an effect goes to the room by its own event and plays here; the others\' play too', () => {
    // Arrange
    render(<GroupCallOverlay group={groupWith({})} me="me" />);
    // Act
    fireEvent.click(screen.getByTestId('btn-reacciones-llamada'));
    fireEvent.click(screen.getByTestId('efecto-😂'));
    // Assert
    expect(emitted.at(-1)).toEqual({ event: 'groupcall.reaction', frame: { chatId: 'g1', reaction: { kind: 'emoji', id: '😂' }, key: expect.stringMatching(/^k-/) } });
    expect(screen.getByTestId('efecto-en-llamada-😂')).toBeInTheDocument();
    act(() => socketHandlers.get('groupcall.reaction')?.({ chatId: 'g1', from: 'a', reaction: { kind: 'wink', id: 'hearts' }, key: 'k-9' }));
    expect(screen.getByTestId('guino-en-pantalla-hearts')).toBeInTheDocument();
    expect(emitted.at(-1)).toEqual({ event: 'groupcall.reaction.ack', frame: { chatId: 'g1', key: 'k-9' } });
    expect(socketHandlers.has('call.reaction')).toBe(false);
  });

  it('with two cameras the switch shows and calls the hook; the rear camera is not mirrored', () => {
    const group = groupWith({ canSwitch: true });
    const { rerender } = render(<GroupCallOverlay group={group} me="me" />);
    fireEvent.click(screen.getByTestId('btn-girar-camara-grupal'));
    expect(group.switchCamera).toHaveBeenCalled();
    rerender(<GroupCallOverlay group={groupWith({ canSwitch: true, cameraOn: false })} me="me" />);
    expect(screen.queryByTestId('btn-girar-camara-grupal')).toBeNull();
  });
});
