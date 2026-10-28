import { describe, expect, it } from 'vitest';
import { CALL_TIMEOUT_MS, type CallState } from './call.js';
import { CONNECT_WAIT_MS, callCaption, callerName, canSwitchCamera, mediaState, mirrorsSelfView, otherFacing, ringStart, waitBeforeGivingUp } from './callMedia.js';

/**
 * Answered ≠ connected (FL8; real test of 17/10/2026: the clock ran from when
 * José answered and he heard nothing). Shared by the app and the web calls.
 */
describe('mediaState', () => {
  it('before connecting for the first time, connecting', () => {
    expect(mediaState('new', false)).toBe('conectando');
    expect(mediaState('checking', false)).toBe('conectando');
    expect(mediaState('disconnected', false)).toBe('conectando');
  });

  it('connected and completed are audio flowing', () => {
    expect(mediaState('connected', false)).toBe('conectada');
    expect(mediaState('completed', true)).toBe('conectada');
  });

  it('cut after having connected: reconnecting; failed is failed', () => {
    expect(mediaState('disconnected', true)).toBe('reconectando');
    expect(mediaState('failed', true)).toBe('fallo');
    expect(mediaState('failed', false)).toBe('fallo');
  });

  it('closed changes nothing: whoever hangs up closes it', () => {
    expect(mediaState('closed', true)).toBe('conectada');
    expect(mediaState('closed', false)).toBe('conectando');
  });
});

describe('waitBeforeGivingUp', () => {
  it('connecting or reconnecting has a limit; connected or failed, none', () => {
    expect(waitBeforeGivingUp('conectando')).toBe(CONNECT_WAIT_MS);
    expect(waitBeforeGivingUp('reconectando')).toBe(CONNECT_WAIT_MS);
    expect(waitBeforeGivingUp('conectada')).toBeNull();
    expect(waitBeforeGivingUp('fallo')).toBeNull();
  });
});

describe('callCaption', () => {
  it('the caller reads «Conectando…» once the other side is answering (backlog 114)', () => {
    const answering: CallState = { fase: 'llamando', desde: 1000, entrante: false, answeringAt: 20_000 };

    expect(callCaption({ state: answering, media: 'conectando', video: false, now: 21_000 })).toBe('Conectando…');
    expect(callCaption({ state: { fase: 'llamando', desde: 1000, entrante: false }, media: 'conectando', video: false, now: 2000 })).toBe('Llamando…');
    expect(callCaption({ state: { fase: 'sonando', desde: 1000, entrante: true, answeringAt: 20_000 }, media: 'conectando', video: true, now: 21_000 })).toBe('Conectando…');
  });

  const since = 1_000_000;
  const active: CallState = { fase: 'activa', desde: since, entrante: false, conectadaEn: since + 5_000 };

  it('active without audio yet says so; with audio, the clock', () => {
    expect(callCaption({ state: active, media: 'conectando', video: false, now: since + 9_000 })).toBe('Conectando…');
    expect(callCaption({ state: active, media: 'reconectando', video: false, now: since + 9_000 })).toBe('Reconectando…');
    expect(callCaption({ state: active, media: 'conectada', video: false, now: since + 70_000 })).toBe('01:05');
  });

  it('calling and ringing, and how it ended', () => {
    expect(callCaption({ state: { fase: 'llamando', desde: since, entrante: false }, media: 'conectando', video: false, now: since })).toBe('Llamando…');
    expect(callCaption({ state: { fase: 'sonando', desde: since, entrante: true }, media: 'conectando', video: true, now: since })).toBe('Videollamada entrante');
    const lost: CallState = { fase: 'terminada', desde: since, entrante: false, conectadaEn: since, terminadaEn: since + 9_000, motivo: 'desconectada', porMi: false };
    expect(callCaption({ state: lost, media: 'fallo', video: false, now: since + 9_000 })).toBe('No se pudo conectar');
    const busy: CallState = { ...lost, conectadaEn: null, motivo: 'ocupado' };
    expect(callCaption({ state: busy, media: 'conectando', video: false, now: since })).toBe('Ocupado en otra llamada');
  });
});

describe('ringStart', () => {
  it('an offer delivered late does not ring another 30 s', () => {
    expect(ringStart(12_000, 100_000)).toBe(100_000 - (CALL_TIMEOUT_MS - 12_000));
    expect(ringStart(undefined, 100_000)).toBe(100_000);
    expect(ringStart(-5, 100_000)).toBe(100_000 - CALL_TIMEOUT_MS);
    expect(ringStart(999_999, 100_000)).toBe(100_000);
  });
});

describe('callerName', () => {
  it('the chat name, then the name the offer brings, then the phone', () => {
    expect(callerName({ chatName: 'Ana', fromName: 'Ana P.', fromPhone: '987654321' })).toBe('Ana');
    expect(callerName({ fromName: 'Ana P.', fromPhone: '987654321' })).toBe('Ana P.');
    expect(callerName({ fromPhone: '987654321' })).toBe('987654321');
    expect(callerName({})).toBe('Alguien');
  });
});

describe('switching the camera in a video call (pending 97)', () => {
  it('goes to the other camera and back', () => {
    expect(otherFacing('user')).toBe('environment');
    expect(otherFacing('environment')).toBe('user');
  });

  it('mirrors my own view only with the front camera', () => {
    expect(mirrorsSelfView('user')).toBe(true);
    expect(mirrorsSelfView('environment')).toBe(false);
  });

  it('offers the switch only with two cameras or more', () => {
    expect(canSwitchCamera(0)).toBe(false);
    expect(canSwitchCamera(1)).toBe(false);
    expect(canSwitchCamera(2)).toBe(true);
  });
});
