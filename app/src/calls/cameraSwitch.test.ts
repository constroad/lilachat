import { describe, expect, it, vi } from 'vitest';

vi.mock('../ui/reportarError', () => ({ reportarError: vi.fn() }));
import { reportarError } from '../ui/reportarError';
import { switchCameraTrack } from './cameraSwitch';

/** 0.1.172 crash reports (28/10): a mistimed tap made the native camera switch throw. */
describe('switchCameraTrack', () => {
  const liveTrack = (apply: () => Promise<void>) => ({ enabled: true, readyState: 'live', applyConstraints: vi.fn(apply) });

  it('a second tap while the first switch runs does nothing; after it ends, it switches again', async () => {
    let finish: () => void = () => undefined;
    const track = liveTrack(() => new Promise<void>((resolve) => (finish = resolve)));
    const switching = { current: false };
    const onSwitched = vi.fn();

    switchCameraTrack({ track, facing: 'user', switching, onSwitched });
    switchCameraTrack({ track, facing: 'user', switching, onSwitched });
    expect(track.applyConstraints).toHaveBeenCalledTimes(1);
    finish();
    await vi.waitFor(() => expect(switching.current).toBe(false));
    expect(onSwitched).toHaveBeenCalledWith('environment');
  });

  it('with the camera off it never calls the native switch', () => {
    const track = { ...liveTrack(async () => undefined), enabled: false };
    switchCameraTrack({ track, facing: 'user', switching: { current: false }, onSwitched: vi.fn() });
    expect(track.applyConstraints).not.toHaveBeenCalled();
  });

  it('a native «not running» is not reported as a crash; a real failure is', async () => {
    const quiet = liveTrack(() => Promise.reject(new Error('Error switching camera: switchCamera: camera is not running.')));
    const loud = liveTrack(() => Promise.reject(new Error('Permission denied')));
    const switching = { current: false };

    switchCameraTrack({ track: quiet, facing: 'user', switching, onSwitched: vi.fn() });
    await vi.waitFor(() => expect(switching.current).toBe(false));
    switchCameraTrack({ track: loud, facing: 'user', switching, onSwitched: vi.fn() });
    await vi.waitFor(() => expect(switching.current).toBe(false));
    expect(reportarError).toHaveBeenCalledTimes(1);
  });
});
