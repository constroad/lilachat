import { describe, expect, it, vi } from 'vitest';
import { startScreenShare, stopScreenShare } from './screenShare';

/** APK 0.1.175: the phone shares its screen in a video call, in the camera's sender, and gets the camera back. */
type FakeTrack = { kind: string; stop: ReturnType<typeof vi.fn>; onended?: () => void };
const track = (kind: string): FakeTrack => ({ kind, stop: vi.fn() });

function callWithCamera() {
  const camera = track('video');
  const sender = { track: camera, replaceTrack: vi.fn(async (next: FakeTrack) => void (sender.track = next)) };
  const pc = { getSenders: () => [{ track: track('audio'), replaceTrack: vi.fn() }, sender] };
  const stream = { getVideoTracks: () => [camera] };
  return { camera, sender, pc, stream };
}

describe('startScreenShare', () => {
  it('puts the shared screen in the camera’s sender, without stopping the camera', async () => {
    // Arrange
    const { camera, sender, pc, stream } = callWithCamera();
    const screen = track('video');
    const getDisplayMedia = vi.fn(async () => ({ getVideoTracks: () => [screen] }));
    // Act
    const share = await startScreenShare({ pc, stream, getDisplayMedia, onEnded: vi.fn() } as never);
    // Assert
    expect(share).not.toBeNull();
    expect(sender.track).toBe(screen);
    expect(camera.stop).not.toHaveBeenCalled();
    expect(screen.onended).toBeTypeOf('function');
  });

  it('is null without a camera (a voice call) and never asks for the screen', async () => {
    const { pc } = callWithCamera();
    const getDisplayMedia = vi.fn();
    expect(await startScreenShare({ pc, stream: { getVideoTracks: () => [] }, getDisplayMedia, onEnded: vi.fn() } as never)).toBeNull();
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });

  it('closing Android’s consent dialog is not an error: it answers null', async () => {
    const { pc, stream } = callWithCamera();
    const getDisplayMedia = vi.fn(async () => Promise.reject(Object.assign(new Error('NotAllowedError'), { name: 'NotAllowedError' })));
    expect(await startScreenShare({ pc, stream, getDisplayMedia, onEnded: vi.fn() } as never)).toBeNull();
  });
});

describe('stopScreenShare', () => {
  it('gives the camera back to the sender and stops the screen (which ends the mediaProjection service)', async () => {
    const { camera, sender, pc, stream } = callWithCamera();
    const screen = track('video');
    const share = await startScreenShare({ pc, stream, getDisplayMedia: async () => ({ getVideoTracks: () => [screen] }), onEnded: vi.fn() } as never);
    await stopScreenShare(share!);
    expect(sender.track).toBe(camera);
    expect(screen.stop).toHaveBeenCalled();
  });
});

describe('stopScreenShare on a closed call', () => {
  it('still stops the screen when the sender can no longer swap', async () => {
    const screen = track('video');
    const sender = { track: screen, replaceTrack: vi.fn(async () => Promise.reject(new Error('closed'))) };
    await expect(stopScreenShare({ track: screen, camera: track('video'), sender } as never)).rejects.toThrow('closed');
    expect(screen.stop).toHaveBeenCalled();
  });
});
