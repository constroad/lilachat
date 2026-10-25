import { beforeEach, describe, expect, it, vi } from 'vitest';

const listChats = vi.fn();
const spaceChats = vi.fn();
vi.mock('../api/client', () => ({ listChats: (...args: unknown[]) => listChats(...args) }));
vi.mock('../spaces/spacesApi', () => ({ spaceChats: (...args: unknown[]) => spaceChats(...args) }));

import { chatListFor } from './listaDelChat';

const SPACE_ID = '6a90cf90d2dbc98541f59aaa';

/** A channel is not in the personal list: its pinned messages, like everything else, come from its space's list (José 25/10). */
describe('chatListFor', () => {
  beforeEach(() => {
    listChats.mockReset().mockResolvedValue({ ok: true, data: { chats: [] } });
    spaceChats.mockReset().mockResolvedValue({ ok: true, data: { chats: [] } });
  });

  it('a chat of a space reads its space list, never the personal one', async () => {
    await chatListFor('jwt', SPACE_ID);
    expect(spaceChats).toHaveBeenCalledWith('jwt', SPACE_ID);
    expect(listChats).not.toHaveBeenCalled();
  });

  it('a personal chat reads the personal list', async () => {
    await chatListFor('jwt', undefined);
    expect(listChats).toHaveBeenCalledWith('jwt');
    expect(spaceChats).not.toHaveBeenCalled();
  });

  it('an empty space id counts as personal (a chat opened from outside has none)', async () => {
    await chatListFor('jwt', '');
    expect(listChats).toHaveBeenCalledWith('jwt');
    expect(spaceChats).not.toHaveBeenCalled();
  });

  it('returns the answer as it came, errors included', async () => {
    spaceChats.mockResolvedValue({ ok: false, status: 404, message: 'x' });
    await expect(chatListFor('jwt', SPACE_ID)).resolves.toEqual({ ok: false, status: 404, message: 'x' });
  });
});
