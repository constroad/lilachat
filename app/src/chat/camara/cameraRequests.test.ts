import { describe, expect, it, vi } from 'vitest';

const allowed = { value: true };
vi.mock('./FormCamera', () => ({ cameraAllowed: async () => allowed.value }));

const { openCamera } = await import('./cameraRequests');

/** José 12/11: any screen of the APK asks the new camera for a shot and waits for it. */
describe('openCamera', () => {
  const stamp = { timemark: true as const, point: null, logo: false, takenAt: '2026-11-12T12:00:00.000Z' };

  it('waits for the shot with its stamp, and gives null when the person closes the camera', async () => {
    // Arrange
    const { pendingForTest } = await import('./cameraRequests');
    // Act
    const first = openCamera({ title: 'Foto de la observación' });
    await Promise.resolve();
    await Promise.resolve();
    pendingForTest()?.finish({ uri: 'file://a.jpg', mime: 'image/jpeg', stamp });
    const second = openCamera({ title: 'Video al Drive', video: { maxSeconds: 60, first: true } });
    await Promise.resolve();
    await Promise.resolve();
    expect(pendingForTest()).toMatchObject({ title: 'Video al Drive', video: { maxSeconds: 60, first: true } });
    pendingForTest()?.finish(null);
    // Assert
    expect(await first).toEqual({ uri: 'file://a.jpg', mime: 'image/jpeg', stamp });
    expect(await second).toBeNull();
    expect(pendingForTest()).toBeNull();
  });

  it('says «denied» without the camera permission, and opens nothing', async () => {
    // Arrange
    allowed.value = false;
    const { pendingForTest } = await import('./cameraRequests');
    // Act
    const reply = await openCamera({ title: 'Foto del avance' });
    // Assert
    expect(reply).toBe('denied');
    expect(pendingForTest()).toBeNull();
    allowed.value = true;
  });
});
