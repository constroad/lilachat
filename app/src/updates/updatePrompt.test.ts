import { afterEach, describe, expect, it, vi } from 'vitest';
import { apkNoticeNow, publishApkNotice, subscribeApkNotice, updatePromptOf } from './updatePrompt';

const idle = { otaPending: false, restartDismissed: false, inCall: false, apk: null, bandOnScreen: false };
const apk = { version: '0.1.194', mandatory: false };

describe('which update prompt shows over any screen', () => {
  it('offers the restart of a downloaded OTA, on the list or inside a channel', () => {
    expect(updatePromptOf({ ...idle, otaPending: true })).toEqual({ kind: 'restart' });
    expect(updatePromptOf({ ...idle, otaPending: true, bandOnScreen: true })).toEqual({ kind: 'restart' });
  });

  it('offers the new APK inside a channel, where the list band is not on screen (José 28/11)', () => {
    expect(updatePromptOf({ ...idle, apk })).toEqual({ kind: 'apk', version: '0.1.194', mandatory: false });
  });

  it('leaves the APK to the band when the list is on screen', () => {
    expect(updatePromptOf({ ...idle, apk, bandOnScreen: true })).toBeNull();
  });

  it('goes back to the APK once the restart was put off', () => {
    expect(updatePromptOf({ ...idle, otaPending: true, restartDismissed: true, apk })?.kind).toBe('apk');
  });

  it('shows nothing during a call, nor with nothing to update', () => {
    expect(updatePromptOf({ ...idle, otaPending: true, apk, inCall: true })).toBeNull();
    expect(updatePromptOf(idle)).toBeNull();
  });
});

describe('the APK notice the list publishes', () => {
  afterEach(() => publishApkNotice(null));

  it('tells its listeners when the version changes, not when only the actions do', () => {
    // Arrange
    const listener = vi.fn();
    const unsubscribe = subscribeApkNotice(listener);
    const later = vi.fn();
    // Act
    publishApkNotice({ ...apk, update: vi.fn(), dismiss: vi.fn() });
    publishApkNotice({ ...apk, update: later, dismiss: vi.fn() });
    apkNoticeNow()?.update();
    unsubscribe();
    publishApkNotice(null);
    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
    expect(apkNoticeNow()).toBeNull();
  });

  it('tells its listeners when the update becomes mandatory', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeApkNotice(listener);
    publishApkNotice({ ...apk, update: vi.fn(), dismiss: vi.fn() });
    publishApkNotice({ ...apk, mandatory: true, update: vi.fn(), dismiss: vi.fn() });
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
