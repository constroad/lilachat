import { describe, expect, it, vi } from 'vitest';
import { buildHeader, setAppUpdateId, subscribeUpdateRequired, reportStatus, UPDATE_HEADER } from './appBuild';

describe('buildHeader', () => {
  it('says the build the server judges against the minimum', () => {
    expect(buildHeader(145)).toEqual({ 'x-lilachat-build': '145' });
  });

  it('says nothing when the build is unknown (0): the server then judges nothing', () => {
    expect(buildHeader(0)).toEqual({});
  });

  it('says which OTA update is running, so a report can tell the code apart from the installed build', () => {
    expect(buildHeader(171, '3f1c2a9e-7d4b-4e5a-9a10-2c5b8f6d1e00')).toEqual({
      'x-lilachat-build': '171',
      [UPDATE_HEADER]: '3f1c2a9e-7d4b-4e5a-9a10-2c5b8f6d1e00',
    });
  });

  it('says «embedded» when the code is the one inside the APK (no update applied)', () => {
    setAppUpdateId(null);
    expect(buildHeader(171)).toEqual({ 'x-lilachat-build': '171', 'x-lilachat-update': 'embedded' });
  });

  it('keeps the update the app started with when none is passed', () => {
    setAppUpdateId('a1b2c3d4-0000-4000-8000-000000000001');
    expect(buildHeader(171)[UPDATE_HEADER]).toBe('a1b2c3d4-0000-4000-8000-000000000001');
    setAppUpdateId(null);
  });
});

describe('reportStatus', () => {
  it('a 426 tells whoever listens that the app must update', () => {
    // Arrange
    const listener = vi.fn();
    const stop = subscribeUpdateRequired(listener);
    // Act
    reportStatus(426);
    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('any other refusal says nothing', () => {
    const listener = vi.fn();
    const stop = subscribeUpdateRequired(listener);
    reportStatus(401);
    reportStatus(500);
    reportStatus(undefined);
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('after unsubscribing it is not called', () => {
    const listener = vi.fn();
    subscribeUpdateRequired(listener)();
    reportStatus(426);
    expect(listener).not.toHaveBeenCalled();
  });
});
