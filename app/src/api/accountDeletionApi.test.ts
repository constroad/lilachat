import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAccountDeletion } from './accountDeletionApi';

/** «Borrar mi cuenta» in the APK's settings (José 19/11). */
describe('requestAccountDeletion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the confirm word and hands back the deadline', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ requested: true, deadline: '2026-12-19T15:00:00.000Z' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    // Act
    const outcome = await requestAccountDeletion('jwt');

    // Assert
    expect(outcome).toEqual({ ok: true, deadline: new Date('2026-12-19T15:00:00.000Z') });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/me\/account-deletion$/);
    expect(init).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ confirm: 'BORRAR' }) }));
  });

  it('says the server refusal, like a space left without anyone in charge', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Estás a cargo del espacio «Constroad»…' }), { status: 409 })));

    // Act
    const outcome = await requestAccountDeletion('jwt');

    // Assert
    expect(outcome).toEqual({ ok: false, message: 'Estás a cargo del espacio «Constroad»…' });
  });

  it('without network it says so instead of failing silently', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    // Act
    const outcome = await requestAccountDeletion('jwt');

    // Assert
    expect(outcome.ok).toBe(false);
  });
});
