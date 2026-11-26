import { describe, expect, it } from 'vitest';
import { PROSPECT_ID, authorKeyOf, contactBadge, prospectAuthorView, prospectChannelName, shownProspectPhone, validateProspectState } from './prospects.js';

/** Dali's prospects (BOTS-API §c-prospectos, José via agentes 16/11): one channel per prospect of a paid ad. */
describe('validateProspectState', () => {
  it('a chat WhatsApp knows only by its LID comes without a number when it says hidden_number', () => {
    const at = '2026-11-26T15:00:00.000Z';
    const hidden = validateProspectState({ hidden_number: true, name: 'Alonso', last_activity_at: at });
    expect(hidden.ok && hidden.state.phone).toBe('');
    expect(validateProspectState({ last_activity_at: at }).ok).toBe(false);
    expect(validateProspectState({ hidden_number: true, phone: '12', last_activity_at: at }).ok).toBe(false);
    expect(shownProspectPhone('')).toBe('Número oculto por WhatsApp');
  });

  const now = '2026-11-17T14:02:00.000Z';

  it('keeps the phone as digits and defaults to Dali attending', () => {
    const valid = validateProspectState({ phone: '+51 949 123 824', last_activity_at: now });
    expect(valid).toEqual({ ok: true, state: { phone: '51949123824', lastActivityAt: now, attendedBy: 'dali' } });
  });

  it('keeps the name, the ad it came from and who attends', () => {
    const valid = validateProspectState({ name: '  Carlos ', phone: '51949123824', last_activity_at: now, attended_by: 'human', source: { kind: 'ctwa', ad_id: '1203', ad_title: 'Asfalto en caliente', ad_url: 'https://fb.me/x' } });
    expect(valid).toEqual({ ok: true, state: { name: 'Carlos', phone: '51949123824', lastActivityAt: now, attendedBy: 'human', source: { kind: 'ctwa', adId: '1203', adTitle: 'Asfalto en caliente', adUrl: 'https://fb.me/x' } } });
  });

  it('José 20/11: keeps the platform the ad ran on, when agentes sends it', () => {
    const valid = validateProspectState({ phone: '51949123824', last_activity_at: now, source: { kind: 'ctwa', platform: 'instagram' } });
    expect(valid).toEqual({ ok: true, state: { phone: '51949123824', lastActivityAt: now, attendedBy: 'dali', source: { kind: 'ctwa', platform: 'instagram' } } });
  });

  it.each([
    [{ phone: '12', last_activity_at: now }, 'phone'],
    [{ phone: '5194912382412345678', last_activity_at: now }, 'phone'],
    [{ phone: '51949123824' }, 'last_activity_at'],
    [{ phone: '51949123824', last_activity_at: 'ayer' }, 'last_activity_at'],
    [{ phone: '51949123824', last_activity_at: now, attended_by: 'robot' }, 'attended_by'],
    [{ phone: '51949123824', last_activity_at: now, name: 'x'.repeat(61) }, 'name'],
    [{ phone: '51949123824', last_activity_at: now, source: { kind: 'web' } }, 'source.kind'],
    [{ phone: '51949123824', last_activity_at: now, source: { kind: 'ctwa', ad_url: 'http://fb.me/x' } }, 'ad_url'],
    [{ phone: '51949123824', last_activity_at: now, source: { kind: 'ctwa', ad_title: 'x'.repeat(121) } }, 'ad_title'],
    [{ phone: '51949123824', last_activity_at: now, source: { kind: 'ctwa', ad_id: 'x'.repeat(65) } }, 'ad_id'],
    [{ phone: '51949123824', last_activity_at: now, source: { kind: 'ctwa', platform: 'tiktok' } }, 'platform'],
  ])('refuses %j naming %s', (raw, field) => {
    const valid = validateProspectState(raw);
    expect(valid.ok).toBe(false);
    expect(valid.ok ? '' : valid.message).toContain(field);
  });

  it('a body that is not an object is refused, not thrown', () => {
    expect(validateProspectState(null).ok).toBe(false);
  });
});

describe('PROSPECT_ID', () => {
  it('takes agentes id with colons, up to 120', () => {
    expect(PROSPECT_ID.test('dali:constroad:9f2c41')).toBe(true);
    expect(PROSPECT_ID.test('a'.repeat(120))).toBe(true);
    expect(PROSPECT_ID.test('a'.repeat(121))).toBe(false);
    expect(PROSPECT_ID.test(':dali')).toBe(false);
    expect(PROSPECT_ID.test('bad id')).toBe(false);
  });
});

describe('names shown', () => {
  it('a Peruvian number in groups of three, any other with its +', () => {
    expect(shownProspectPhone('51949123824')).toBe('+51 949 123 824');
    expect(shownProspectPhone('5491112345678')).toBe('+5491112345678');
  });

  it('the channel is the name, or «Prospecto ·» and the number', () => {
    expect(prospectChannelName({ name: 'Carlos', phone: '51949123824' })).toBe('Carlos');
    expect(prospectChannelName({ phone: '51949123824' })).toBe('Prospecto · +51 949 123 824');
  });

  it('the contact pill says WhatsApp', () => {
    expect(contactBadge).toBe('WhatsApp');
  });
});

describe('authorKeyOf', () => {
  it('a prospect\'s message is another author than the bot that carried it', () => {
    expect(authorKeyOf({ senderId: 'bot', prospect: { name: 'Carlos', phone: '51949123824' } })).toBe('prospect:51949123824');
    expect(authorKeyOf({ senderId: 'bot' })).toBe('bot');
  });

  it('a WhatsApp group sender without a phone (fase 1: a @lid contact can hide it) still groups by name, not all under the same key', () => {
    expect(authorKeyOf({ senderId: 'bot', prospect: { name: 'Carlos' } })).toBe('prospect:Carlos');
    expect(authorKeyOf({ senderId: 'bot', prospect: { name: 'Ana' } })).toBe('prospect:Ana');
  });
});

describe('prospectAuthorView', () => {
  it('a prospect\'s message draws their name with the WhatsApp pill, never as the app', () => {
    expect(prospectAuthorView({ prospect: { name: 'Carlos' } })).toEqual({ name: 'Carlos', badge: 'WhatsApp', isApp: false });
  });

  it('any other message keeps its author', () => {
    expect(prospectAuthorView({})).toBeNull();
  });
});
