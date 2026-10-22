import { describe, expect, it } from 'vitest';
import { fullScreenLostOnUpdate, shouldAskFullScreen } from './fullScreenPrompt';

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

describe('fullScreenLostOnUpdate', () => {
  it('allowed in the last version and denied in this one: the update took it (tells the diagnostics)', () => {
    // Arrange
    const before = { version: '0.1.145', allowed: true };
    // Act
    const lost = fullScreenLostOnUpdate(before, { version: '0.1.146', allowed: false });
    // Assert
    expect(lost).toBe(true);
  });

  it('turned off within the same version is the person, not the update', () => {
    expect(fullScreenLostOnUpdate({ version: '0.1.146', allowed: true }, { version: '0.1.146', allowed: false })).toBe(false);
  });

  it('already denied before the update says nothing new', () => {
    expect(fullScreenLostOnUpdate({ version: '0.1.145', allowed: false }, { version: '0.1.146', allowed: false })).toBe(false);
  });

  it('the first launch with nothing saved says nothing', () => {
    expect(fullScreenLostOnUpdate(null, { version: '0.1.146', allowed: false })).toBe(false);
  });
});
