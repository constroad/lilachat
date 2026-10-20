import { describe, expect, it } from 'vitest';
import { acuseVivo } from './acuseVivo';

describe('acuseVivo', () => {
  const chats = [{ id: 'a', othersReadSeq: 3, othersDeliveredSeq: 5 }];

  it('lo que la lista sabe de ESE chat, como texto estable', () => {
    expect(acuseVivo(chats, 'a')).toBe('3:5');
  });

  it('sin lista o sin el chat, cero', () => {
    expect(acuseVivo(null, 'a')).toBe('0:0');
    expect(acuseVivo(chats, 'b')).toBe('0:0');
  });
});
