import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { ignoreClosedBase } from './baseLocal';

/**
 * Logging out closes and deletes the local base at once, before the screen
 * unmounts: a list load still on its way rejects with «Database has been
 * closed». It has nowhere to go and is not an error (gates 21/10: four
 * unhandled rejections in `App.test.tsx`). Anything else still fails.
 */
describe('ignoreClosedBase', () => {
  it('swallows a write into the base closed by logging out', async () => {
    const base = new Dexie('qa-closed-base');
    base.version(1).stores({ chats: 'id' });
    base.close();
    await expect(base.table('chats').put({ id: 'c1' }).catch(ignoreClosedBase)).resolves.toBeUndefined();
  });
  it('lets any other error through', async () => {
    await expect(Promise.reject(new Error('disk full')).catch(ignoreClosedBase)).rejects.toThrow('disk full');
  });
});
