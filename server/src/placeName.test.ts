import { describe, expect, it, vi } from 'vitest';
import { addressOf, createPlaceLookup } from './placeName.js';

const point = { lat: -12.0464, lng: -77.0428, precision: 12 };
const reply = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const street = { address: { road: 'Avenida Alfonso Ugarte', house_number: '123', suburb: 'Breña', city: 'Lima' } };

describe('addressOf', () => {
  it('reads the street, its number, the district and the city', () => {
    expect(addressOf(street)).toBe('Avenida Alfonso Ugarte 123, Breña, Lima');
  });

  it('a place with no street falls back on the first parts of its long name', () => {
    expect(addressOf({ address: {}, display_name: 'Cantera Norte, Carabayllo, Lima, Perú, 15121' })).toBe('Cantera Norte, Carabayllo, Lima');
  });

  it('a nameless path does not repeat the city or show a postal code', () => {
    expect(addressOf({ address: { city: 'Lima' }, display_name: 'Lima, Lima Metropolitana, Lima, 15082, Perú' })).toBe('Lima, Lima Metropolitana, Perú');
  });

  it('an answer with nothing to read is no address', () => {
    expect(addressOf({ error: 'Unable to geocode' })).toBeNull();
    expect(addressOf(null)).toBeNull();
  });
});

describe('createPlaceLookup', () => {
  it('asks once for a block: the second reading comes from memory', async () => {
    // Arrange
    const fetcher = vi.fn(async () => reply(street));
    const lookup = createPlaceLookup({ fetcher, now: () => 1_000 });
    // Act
    const first = await lookup(point);
    const second = await lookup({ ...point, lat: -12.04642 });
    // Assert
    expect(first).toBe('Avenida Alfonso Ugarte 123, Breña, Lima');
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('identifies the app and gives away nobody\'s account', async () => {
    // Arrange
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => reply(street));
    const lookup = createPlaceLookup({ fetcher, now: () => 1_000 });
    // Act
    await lookup(point);
    // Assert
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toContain('lat=-12.0464');
    // Zoom 18 answers with a nameless path where 19 finds the avenue (E2E 06/11).
    expect(url).toContain('zoom=19');
    expect(new Headers(init.headers).get('User-Agent')).toBe('lilachat/1.0 (reverse-geocode)');
  });

  it('a fallen provider costs the address, never the photo, and the next try asks again', async () => {
    // Arrange
    const fetcher = vi.fn(async () => { throw new Error('offline'); });
    const lookup = createPlaceLookup({ fetcher, now: () => 1_000 });
    // Act and assert
    expect(await lookup(point)).toBeNull();
    expect(await lookup(point)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('an answer that is not a success is no address', async () => {
    // Arrange
    const lookup = createPlaceLookup({ fetcher: async () => reply({}, false), now: () => 1_000 });
    // Act and assert
    expect(await lookup(point)).toBeNull();
  });

  it('what it remembers ages out', async () => {
    // Arrange
    let clock = 1_000;
    const fetcher = vi.fn(async () => reply(street));
    const lookup = createPlaceLookup({ fetcher, now: () => clock });
    await lookup(point);
    // Act
    clock += 11 * 60_000;
    await lookup(point);
    // Assert
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('never holds more than its limit of places', async () => {
    // Arrange
    const fetcher = vi.fn(async () => reply(street));
    const lookup = createPlaceLookup({ fetcher, now: () => 1_000, maxPlaces: 2 });
    // Act: three blocks, and the first one was pushed out.
    await lookup(point);
    await lookup({ ...point, lat: -12.1 });
    await lookup({ ...point, lat: -12.2 });
    await lookup(point);
    // Assert
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
