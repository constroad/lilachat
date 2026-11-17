import { describe, expect, it } from 'vitest';
import type { ProspectView } from './prospectBoard.js';
import { CHANGE_FAILED_MESSAGE, changeOutcomeOf, STALE_MESSAGE } from './prospectChange.js';

/** What a seller sees after taking, planning or closing a prospect: the same on the web and on the APK. */
const prospect: ProspectView = { id: 'dali:51949123824', chatId: '6739f0c2a1b2c3d4e5f60718', phone: '51949123824', lastActivityAt: '2026-11-17T15:00:00.000Z', attendedBy: 'human', version: 4, createdAt: '2026-11-17T12:00:00.000Z' };

describe('changeOutcomeOf', () => {
  it('returns the prospect the server saved', () => {
    expect(changeOutcomeOf({ ok: true, data: { prospect } })).toEqual({ ok: true, prospect });
  });

  it('a 409 means someone was first: stale, with the message that says so', () => {
    expect(changeOutcomeOf({ ok: false, status: 409, message: 'version_conflict' })).toEqual({ ok: false, stale: true, message: STALE_MESSAGE });
  });

  it('any other refusal keeps the server message', () => {
    expect(changeOutcomeOf({ ok: false, status: 403, message: 'Solo un admin del espacio puede reasignarlo.' })).toEqual({ ok: false, stale: false, message: 'Solo un admin del espacio puede reasignarlo.' });
  });

  it('without a message (no network, a cut body) it still says something', () => {
    expect(changeOutcomeOf({ ok: false })).toEqual({ ok: false, stale: false, message: CHANGE_FAILED_MESSAGE });
    expect(changeOutcomeOf({ ok: false, status: 500, message: '' })).toEqual({ ok: false, stale: false, message: CHANGE_FAILED_MESSAGE });
  });
});
