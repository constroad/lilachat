import { describe, expect, it, vi } from 'vitest';
import type { Row } from './rowKinds';

vi.mock('./voiceNoteCache', () => ({ knownLocal: (url: string) => (url.endsWith('2.m4a') ? 'file:///2.m4a' : undefined) }));
vi.mock('./voicePlayer', () => ({ setVoiceNoteQueue: vi.fn() }));

const { noteAfter } = await import('./useVoiceNoteQueue');

const voice = (seq: number, senderId = 'ana') => ({ chatId: 'c1', seq, senderId, media: { url: `https://x/${seq}.m4a`, mime: 'audio/mp4', durationMs: 4000 } }) as unknown as Row;
const source = (rows: Row[]) => ({ chatId: 'c1', rows, names: new Map([['ana', 'Ana Torres']]), photos: new Map([['ana', 'https://x/ana.jpg']]) });

describe('the note after this one', () => {
  it('comes from the phone when it is already downloaded, with who recorded it', () => {
    expect(noteAfter('c1:1', source([voice(1), voice(2)]))).toEqual({ id: 'c1:2', url: 'file:///2.m4a', authorName: 'Ana Torres', authorPhoto: 'https://x/ana.jpg', durationS: 4 });
  });

  it('plays from the network when it is not, and says «Nota de voz» for an unknown author', () => {
    expect(noteAfter('c1:2', source([voice(2), voice(3, 'beto')]))).toMatchObject({ url: 'https://x/3.m4a', authorName: 'Nota de voz' });
  });

  it('nothing follows the last note', () => {
    expect(noteAfter('c1:1', source([voice(1)]))).toBeNull();
  });
});
