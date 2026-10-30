import { describe, expect, it } from 'vitest';
import { callBarButtons, moreOptions } from './callBarLayout';

/** Pending 106 (José, 28/10, design c-02/c-03): the call's controls like WhatsApp's. */
describe('callBarButtons', () => {
  it('a video call: more, camera, speaker, microphone and hang up, in that order', () => {
    expect(callBarButtons(true)).toEqual(['more', 'camera', 'speaker', 'mic', 'hangup']);
  });

  it('a voice call has no camera button (adding video mid-call needs renegotiating)', () => {
    expect(callBarButtons(false)).toEqual(['more', 'speaker', 'mic', 'hangup']);
  });
});

describe('moreOptions', () => {
  it('«Enviar mensaje» only when the call has its chat; effects and winks always', () => {
    expect(moreOptions(true)).toEqual(['message', 'reactions']);
    expect(moreOptions(false)).toEqual(['reactions']);
  });

  it('«Compartir pantalla» only in a video call with the camera on (APK 0.1.175, mediaProjection)', () => {
    expect(moreOptions(true, true)).toEqual(['message', 'screen', 'reactions']);
    expect(moreOptions(false, true)).toEqual(['screen', 'reactions']);
    expect(moreOptions(true, false)).toEqual(['message', 'reactions']);
  });
});
