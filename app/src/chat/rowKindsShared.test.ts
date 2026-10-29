import { describe, expect, it } from 'vitest';
import { sharedContactOf, sharedLocationOf, type Row } from './rowKinds';

const row = (extra: Record<string, unknown>): Row => ({ chatId: '6720f0a1b2c3d4e5f6a7b8c9', seq: 7, senderId: 'ana', clientKey: 'k7', kind: 'text', at: '2026-10-28T21:15:00.000Z', body: 'Ubicación', ...extra }) as Row;
const location = { lat: -12.0464, lng: -77.0428, accuracy: 5, liveUntil: '2026-10-28T21:30:00.000Z' };

describe('a shared location or contact draws its card in every layout (28/10: the channel showed only «Ubicación»)', () => {
  it('a location message gives its location, live fields included', () => {
    expect(sharedLocationOf(row({ kind: 'location', location }))).toEqual(location);
  });

  it('deleted for everyone, pending or of another kind, there is no card', () => {
    expect(sharedLocationOf(row({ kind: 'location', location, deletedAt: '2026-10-28T21:16:00.000Z' }))).toBeUndefined();
    expect(sharedLocationOf(row({ kind: 'text', location }))).toBeUndefined();
    expect(sharedLocationOf({ pending: true, clientKey: 'k1', queuedAt: '2026-10-28T21:15:00.000Z' } as Row)).toBeUndefined();
  });

  it('a contact message gives its contact, and nothing once deleted', () => {
    const contact = { name: 'Carla Ríos', phones: ['+51902049935'] };
    expect(sharedContactOf(row({ kind: 'contact', contact }))).toEqual(contact);
    expect(sharedContactOf(row({ kind: 'contact', contact, deletedAt: '2026-10-28T21:16:00.000Z' }))).toBeUndefined();
  });
});
