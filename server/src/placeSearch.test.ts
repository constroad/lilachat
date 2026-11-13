import { describe, expect, it, vi } from 'vitest';
import { createPlaceSearch } from './placeSearch.js';

/** José 08/11: «buscar un lugar o pegar el enlace que manda el cliente» over the work map. */
const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body, headers: new Headers() }) as Response;
const redirect = (location: string) => ({ ok: false, status: 302, headers: new Headers({ location }), json: async () => ({}) }) as Response;

describe('createPlaceSearch', () => {
  it('coordinates answer at once, without asking anyone', async () => {
    const fetcher = vi.fn();
    const search = createPlaceSearch({ fetcher, now: () => 0 });
    expect(await search('-12.05,-77.03', 'u1')).toEqual({ ok: true, results: [{ name: '-12.05, -77.03', lat: -12.05, lng: -77.03 }] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('a short link is followed by its Location only, and remembered a day', async () => {
    const fetcher = vi.fn(async () => redirect('https://www.google.com/maps/place/Obra/@-12.04,-77.04,17z/data=!3d-12.0464!4d-77.0429'));
    const search = createPlaceSearch({ fetcher, now: () => 0 });
    const first = await search('https://maps.app.goo.gl/AbC', 'u1');
    await search('https://maps.app.goo.gl/AbC', 'u1');
    expect(first).toEqual({ ok: true, results: [{ name: 'Ubicación del enlace', lat: -12.0464, lng: -77.0429 }] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]).toMatchObject({ redirect: 'manual' });
  });

  it('a short link that lands on a place name searches that name', async () => {
    const fetcher = vi.fn(async (url: string) => (url.startsWith('https://maps.app') ? redirect('https://www.google.com/maps/place/Plaza+Dos+de+Mayo,+Lima/data=xyz') : json([{ display_name: 'Plaza Dos de Mayo, Lima', lat: '-12.0464', lon: '-77.0429' }])));
    const search = createPlaceSearch({ fetcher, now: () => 0 });
    expect(await search('https://maps.app.goo.gl/AbC', 'u1')).toEqual({ ok: true, results: [{ name: 'Plaza Dos de Mayo, Lima', lat: -12.0464, lng: -77.0429 }] });
    expect(String(fetcher.mock.calls[1]![0])).toContain('q=Plaza+Dos+de+Mayo%2C+Lima');
  });

  it('a name goes to Nominatim with our own User-Agent and the view as a bias', async () => {
    const fetcher = vi.fn(async () => json([{ display_name: 'Jirón Lampa, Lima', lat: '-12.05', lon: '-77.03' }]));
    const search = createPlaceSearch({ fetcher, now: () => 0 });
    const found = await search('Jr. Lampa', 'u1', { lat: -12.05, lng: -77.03 });
    expect(found).toEqual({ ok: true, results: [{ name: 'Jirón Lampa, Lima', lat: -12.05, lng: -77.03 }] });
    const [url, init] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toContain('viewbox=');
    // José 12/11: «Plaza San Martín» showed Buenos Aires, Córdoba and México under the one in Lima.
    expect(url).toContain('countrycodes=pe');
    expect(url).toContain('bounded=0');
    expect(url).toContain('limit=6');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^lilachat/);
  });

  it('nothing found says so; a failure of the provider too', async () => {
    const search = createPlaceSearch({ fetcher: vi.fn(async () => json([])), now: () => 0 });
    expect(await search('Calle que no existe', 'u1')).toEqual({ ok: false, message: 'No encontramos ese lugar. Prueba con la calle y el distrito, o pega el enlace de Google Maps.' });
    const broken = createPlaceSearch({ fetcher: vi.fn(async () => { throw new Error('timeout'); }), now: () => 0 });
    expect((await broken('Jr. Lampa', 'u1')).ok).toBe(false);
  });

  it('a person asking too often waits: 20 searches a minute', async () => {
    const search = createPlaceSearch({ fetcher: vi.fn(async () => json([{ display_name: 'X', lat: '1', lon: '1' }])), now: () => 0 });
    for (let index = 0; index < 20; index += 1) await search(`Lugar ${index}`, 'u1');
    expect(await search('Lugar 21', 'u1')).toEqual({ ok: false, message: 'Muchas búsquedas seguidas. Espera un minuto.' });
    expect((await search('Lugar 21', 'u2')).ok).toBe(true);
  });
});
