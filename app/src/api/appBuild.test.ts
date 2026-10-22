import { describe, expect, it, vi } from 'vitest';
import { buildHeader, subscribeUpdateRequired, reportStatus } from './appBuild';

describe('buildHeader', () => {
  it('says the build the server judges against the minimum', () => {
    expect(buildHeader(145)).toEqual({ 'x-lilachat-build': '145' });
  });

  it('says nothing when the build is unknown (0): the server then judges nothing', () => {
    expect(buildHeader(0)).toEqual({});
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
