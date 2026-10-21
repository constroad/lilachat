import { describe, expect, it } from 'vitest';
import { browserNoticeText, shouldShowBrowserNotice } from './browserNotice';

const base = { senderId: 'ana', me: 'jose', hidden: true, muted: false, kind: 'text', threadOnly: false, permission: 'granted' as NotificationPermission };

/** José, 21/10: with the tab out of sight there was no system notice (the server only pushes to who has no live socket). */
describe('shouldShowBrowserNotice', () => {
  it('a message from someone else, with the tab hidden and permission given', () => {
    expect(shouldShowBrowserNotice(base)).toBe(true);
  });
  it('not mine, not with the tab in sight, not muted, not a notice line, not without permission, not a thread-only reply', () => {
    expect(shouldShowBrowserNotice({ ...base, senderId: 'jose' })).toBe(false);
    expect(shouldShowBrowserNotice({ ...base, hidden: false })).toBe(false);
    expect(shouldShowBrowserNotice({ ...base, muted: true })).toBe(false);
    expect(shouldShowBrowserNotice({ ...base, kind: 'system' })).toBe(false);
    expect(shouldShowBrowserNotice({ ...base, permission: 'default' })).toBe(false);
    expect(shouldShowBrowserNotice({ ...base, threadOnly: true })).toBe(false);
  });
});

describe('browserNoticeText', () => {
  it('the same words as the push: the chat as title, nudges and winks said plainly', () => {
    expect(browserNoticeText({ name: 'Ana', kind: 'direct' }, { kind: 'zumbido', body: undefined })).toEqual({ titulo: 'Ana', cuerpo: 'Te mandó un zumbido' });
    expect(browserNoticeText({ name: 'Ana', kind: 'direct' }, { kind: 'text', body: 'Hola' }).cuerpo).toBe('Hola');
  });
  it('a secret chat never shows the text', () => {
    expect(browserNoticeText({ name: 'Ana', kind: 'direct', encrypted: true }, { kind: 'text', body: 'secreto' }).cuerpo).not.toContain('secreto');
  });
});
