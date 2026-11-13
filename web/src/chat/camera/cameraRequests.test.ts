import { afterEach, describe, expect, it, vi } from 'vitest';
import { openWebCamera, pendingForTest, shootOrPick } from './cameraRequests';

const phone = () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('shootOrPick', () => {
  it('opens the file picker on a computer, and on a phone for a gallery field', () => {
    // Arrange
    const pick = vi.fn();
    // Act
    shootOrPick({ title: 'Foto' }, {}, pick, vi.fn());
    phone();
    shootOrPick({ title: 'Foto' }, { gallery: true }, pick, vi.fn());
    // Assert
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('on a phone waits for the camera and hands the shot over; a closed camera hands nothing', async () => {
    // Arrange
    phone();
    const pick = vi.fn();
    const onFile = vi.fn();
    const shot = new File(['x'], 'foto-1.jpg', { type: 'image/jpeg' });
    // Act
    shootOrPick({ title: 'Foto de avance' }, {}, pick, onFile);
    const asked = pendingForTest();
    asked?.finish(shot);
    await Promise.resolve();
    const closed = openWebCamera({ title: 'Otra' });
    pendingForTest()?.finish(null);
    // Assert
    expect(asked?.title).toBe('Foto de avance');
    expect(pick).not.toHaveBeenCalled();
    expect(onFile).toHaveBeenCalledWith(shot);
    expect(await closed).toBeNull();
  });
});
