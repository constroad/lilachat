import { describe, expect, it } from 'vitest';
import { firstShownAnswer, savedAnswerKey, settleServiceAnswer, shouldPrefetchDetail, readSavedAnswer, savedAnswerLine, type SavedAnswer } from './savedServiceAnswer.js';
import type { ServiceAskResult } from './serviceAsk.js';

type Detail = { name: string };
const SPACE = '6650f1a2b3c4d5e6f7a8b9c0';
const SAVED: SavedAnswer<Detail> = { value: { name: 'Parches Jr. Conchucos' }, savedAt: 1_700_000_000_000 };
const FRESH: ServiceAskResult<Detail> = { ok: true, value: { name: 'Parches Jr. Conchucos (v2)' } };
const OFFLINE: ServiceAskResult<Detail> = { ok: false, message: 'Sin conexión. Inténtalo de nuevo.', portalUrl: null, offline: true };
const REFUSED: ServiceAskResult<Detail> = { ok: false, message: 'No tienes acceso a este servicio.', portalUrl: null };

describe('savedAnswerKey', () => {
  it('starts with the space id so forgetting the space drops it', () => {
    // Act
    const key = savedAnswerKey(SPACE, 'detail', 'cli-20601234567', '66a1b2c3d4e5f6a7b8c9d0e1');
    // Assert
    expect(key.startsWith(`${SPACE}:`)).toBe(true);
    expect(key).toBe(`${SPACE}:service-detail:cli-20601234567:66a1b2c3d4e5f6a7b8c9d0e1`);
  });
});

describe('firstShownAnswer', () => {
  it('paints the saved copy at once, marked with when it was saved', () => {
    expect(firstShownAnswer(SAVED)).toEqual({ ok: true, value: SAVED.value, savedAt: SAVED.savedAt });
  });

  it('is null without a saved copy (the loading block)', () => {
    expect(firstShownAnswer(null)).toBeNull();
  });
});

describe('settleServiceAnswer', () => {
  it('a fresh answer replaces the saved one and is written', () => {
    // Act
    const settled = settleServiceAnswer(FRESH, SAVED, 1_700_000_100_000);
    // Assert
    expect(settled.shown).toEqual(FRESH);
    expect(settled.write).toEqual({ value: { name: 'Parches Jr. Conchucos (v2)' }, savedAt: 1_700_000_100_000 });
    expect(settled.drop).toBe(false);
  });

  it('without signal keeps the saved copy on screen, flagged offline', () => {
    const settled = settleServiceAnswer(OFFLINE, SAVED, 1_700_000_100_000);
    expect(settled.shown).toEqual({ ok: true, value: SAVED.value, savedAt: SAVED.savedAt, offline: true });
    expect(settled.write).toBeNull();
    expect(settled.drop).toBe(false);
  });

  it('without signal and nothing saved shows the offline failure', () => {
    const settled = settleServiceAnswer(OFFLINE, null, 1);
    expect(settled.shown).toEqual(OFFLINE);
    expect(settled.drop).toBe(false);
  });

  it('a refusal from the server wins over the copy and deletes it (access removed)', () => {
    const settled = settleServiceAnswer(REFUSED, SAVED, 1);
    expect(settled.shown).toEqual(REFUSED);
    expect(settled.write).toBeNull();
    expect(settled.drop).toBe(true);
  });
});

describe('readSavedAnswer', () => {
  it('reads what was written', () => {
    expect(readSavedAnswer<Detail>(JSON.stringify(SAVED))).toEqual(SAVED);
  });

  it.each([null, '', 'not json', '{"value":1}', '{"savedAt":"x","value":{}}', '[]', 'null'])('ignores a broken copy: %s', (raw) => {
    expect(readSavedAnswer<Detail>(raw)).toBeNull();
  });
});

describe('shouldPrefetchDetail', () => {
  const NOW = 1_700_100_000_000;
  const HOUR = 3_600_000;

  it('prefetches an open service never saved on this phone', () => {
    expect(shouldPrefetchDetail({ status: 'in_progress', savedAt: null, now: NOW })).toBe(true);
  });

  it('skips a copy younger than six hours', () => {
    expect(shouldPrefetchDetail({ status: 'in_progress', savedAt: NOW - 5 * HOUR, now: NOW })).toBe(false);
  });

  it('refreshes a copy older than six hours', () => {
    expect(shouldPrefetchDetail({ status: 'pending', savedAt: NOW - 7 * HOUR, now: NOW })).toBe(true);
  });

  it.each(['completed', 'rejected'] as const)('never prefetches a closed service: %s', (status) => {
    expect(shouldPrefetchDetail({ status, savedAt: null, now: NOW })).toBe(false);
  });
});

describe('savedAnswerLine', () => {
  // 2026-11-24 14:05 UTC = 09:05 in Lima.
  const SAVED_AT = Date.UTC(2026, 10, 24, 14, 5);

  it('offline names the moment the copy was saved, in Lima', () => {
    expect(savedAnswerLine({ savedAt: SAVED_AT, offline: true })).toBe('Sin señal · datos guardados el 24 nov, 9:05 a. m.');
  });

  it('online says it is refreshing behind', () => {
    expect(savedAnswerLine({ savedAt: SAVED_AT })).toBe('Datos guardados el 24 nov, 9:05 a. m. · actualizando…');
  });
});
