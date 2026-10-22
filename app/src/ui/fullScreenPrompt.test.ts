import { describe, expect, it } from 'vitest';
import { shouldAskFullScreen } from './fullScreenPrompt';

describe('shouldAskFullScreen', () => {
  it('asks once a version when Android denies full-screen calls', () => {
    // Arrange
    const state = { allowed: false, version: '0.1.143', askedForVersion: '0.1.142' };
    // Act
    const ask = shouldAskFullScreen(state);
    // Assert
    expect(ask).toBe(true);
  });

  it('does not ask again in the same version after «Ahora no»', () => {
    expect(shouldAskFullScreen({ allowed: false, version: '0.1.143', askedForVersion: '0.1.143' })).toBe(false);
  });

  it('never asks when they are allowed', () => {
    expect(shouldAskFullScreen({ allowed: true, version: '0.1.143', askedForVersion: null })).toBe(false);
  });

  it('asks on the first launch ever if denied', () => {
    expect(shouldAskFullScreen({ allowed: false, version: '0.1.143', askedForVersion: null })).toBe(true);
  });

  it('does not ask without a known version (web or a broken build)', () => {
    expect(shouldAskFullScreen({ allowed: false, version: '', askedForVersion: null })).toBe(false);
  });
});
