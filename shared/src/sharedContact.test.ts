import { describe, expect, it } from 'vitest';
import { cleanSharedContact, sharedContactBody } from './sharedContact.js';

/** Pending 9 (José, 20/10): sharing a contact in the chat, like WhatsApp. */
describe('cleanSharedContact', () => {
  it('a Peruvian number keeps its 9 local digits, whatever the format', () => {
    expect(cleanSharedContact({ name: '  Wilson Zeña ', phone: '+51 987 654 321' })).toEqual({ ok: true, name: 'Wilson Zeña', phone: '987654321', local: '987654321' });
  });

  it('a foreign number is kept as it was dialed, digits and the plus only', () => {
    expect(cleanSharedContact({ name: 'Ana', phone: '+1 (555) 010-9999' })).toEqual({ ok: true, name: 'Ana', phone: '+15550109999', local: null });
  });

  it('without a name or a phone, it says what is missing', () => {
    expect(cleanSharedContact({ name: ' ', phone: '987654321' })).toEqual({ ok: false, message: 'El contacto no tiene nombre.' });
    expect(cleanSharedContact({ name: 'Ana', phone: 'abc' })).toEqual({ ok: false, message: 'El contacto no tiene un teléfono.' });
  });

  it('a very long name is cut to 60 characters', () => {
    const cleaned = cleanSharedContact({ name: 'x'.repeat(80), phone: '987654321' });
    expect(cleaned.ok && cleaned.name.length).toBe(60);
  });
});

describe('sharedContactBody', () => {
  it('is what the list, the notification and the search read', () => {
    expect(sharedContactBody('Wilson Zeña')).toBe('Contacto: Wilson Zeña');
  });
});
