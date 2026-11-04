import { describe, expect, it } from 'vitest';
import { noteAfter } from './useVoiceNoteQueue';
import type { MensajeEnPantalla } from './types';

const voice = (seq: number, senderId = 'ana') => ({ seq, senderId, media: { url: `https://x/${seq}.m4a`, mime: 'audio/mp4', durationMs: 4000 } }) as unknown as MensajeEnPantalla;
const source = (messages: MensajeEnPantalla[]) => ({ chatId: 'c1', messages, names: new Map([['ana', 'Ana Torres']]) });

describe('the note after this one (web)', () => {
  it('carries who recorded it and its length', () => {
    expect(noteAfter('c1:1', source([voice(1), voice(2)]))).toEqual({ id: 'c1:2', chatId: 'c1', url: 'https://x/2.m4a', authorName: 'Ana Torres', durationS: 4 });
  });

  it('says «Nota de voz» for an unknown author', () => {
    expect(noteAfter('c1:1', source([voice(1), voice(2, 'beto')]))?.authorName).toBe('Nota de voz');
  });

  it('nothing follows the last note', () => {
    expect(noteAfter('c1:1', source([voice(1)]))).toBeNull();
  });
});
