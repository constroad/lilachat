import { describe, expect, it, vi } from 'vitest';
import { coordsFromText, findPlace, isShortMapsLink, PLACE_SEARCH_FAILED, placeQueryOf, placeResultsOf, PLACE_RESULTS_MAX } from './placeSearch.js';

/** José 08/11: search a place or paste the location link the client sends, and draw from there. */
describe('coordsFromText', () => {
  it('reads the exact marker of a long Google Maps link before the camera center', () => {
    const link = 'https://www.google.com/maps/place/Plaza+Dos+de+Mayo/@-12.0461,-77.0428,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-12.0464083!4d-77.0429731';
    expect(coordsFromText(link)).toEqual({ lat: -12.0464083, lng: -77.0429731 });
  });

  it('reads ?q=, ll=, daddr= and /@ in that order, and plain «lat,lng»', () => {
    expect(coordsFromText('https://maps.google.com/?q=-12.05%2C-77.03')).toEqual({ lat: -12.05, lng: -77.03 });
    expect(coordsFromText('https://maps.google.com/?q=-12.05,-77.03&z=17')).toEqual({ lat: -12.05, lng: -77.03 });
    expect(coordsFromText('https://maps.google.com/maps?ll=-12.1,-77.2&z=15')).toEqual({ lat: -12.1, lng: -77.2 });
    expect(coordsFromText('https://maps.google.com/maps?daddr=-12.3,-77.4')).toEqual({ lat: -12.3, lng: -77.4 });
    expect(coordsFromText('https://www.google.com/maps/@-12.0461,-77.0428,17z')).toEqual({ lat: -12.0461, lng: -77.0428 });
    expect(coordsFromText(' -12.0464, -77.0429 ')).toEqual({ lat: -12.0464, lng: -77.0429 });
  });

  it('refuses what is not a place on Earth, and a plain name', () => {
    expect(coordsFromText('120,300')).toBeNull();
    expect(coordsFromText('Plaza Dos de Mayo')).toBeNull();
    expect(coordsFromText('')).toBeNull();
  });
});

describe('isShortMapsLink', () => {
  it('only the three short domains of Google Maps', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/AbCdEf123')).toBe(true);
    expect(isShortMapsLink('https://goo.gl/maps/AbCdEf123')).toBe(true);
    expect(isShortMapsLink('https://g.co/kgs/AbCdEf')).toBe(true);
    expect(isShortMapsLink('https://goo.gl/AbCdEf')).toBe(false);
    expect(isShortMapsLink('https://maps.app.goo.gl.evil.com/x')).toBe(false);
    expect(isShortMapsLink('http://maps.app.goo.gl/x')).toBe(false);
  });
});

describe('placeQueryOf', () => {
  it('coordinates go straight, a short link to the server, a name to the search', () => {
    expect(placeQueryOf('-12.05,-77.03')).toEqual({ kind: 'point', point: { lat: -12.05, lng: -77.03 } });
    expect(placeQueryOf('https://maps.app.goo.gl/AbC')).toEqual({ kind: 'short_link', url: 'https://maps.app.goo.gl/AbC' });
    expect(placeQueryOf('  Jr. Lampa 500, Lima ')).toEqual({ kind: 'name', text: 'Jr. Lampa 500, Lima' });
    expect(placeQueryOf('ab')).toEqual({ kind: 'too_short' });
  });
});

describe('placeResultsOf, what Nominatim answers', () => {
  it('keeps name and point, at most six', () => {
    const raw = Array.from({ length: 8 }, (_, index) => ({ display_name: `Lugar ${index}, Lima, Perú`, lat: '-12.05', lon: String(-77 - index / 100) }));
    const results = placeResultsOf([{ lat: 'x' }, ...raw]);
    expect(results).toHaveLength(PLACE_RESULTS_MAX);
    expect(results[0]).toEqual({ name: 'Lugar 0, Lima, Perú', lat: -12.05, lng: -77 });
    expect(placeResultsOf('nada')).toEqual([]);
  });
});

describe('findPlace', () => {
  it('coordinates do not reach the server; a name does, with the view', async () => {
    const ask = vi.fn(async () => ({ ok: true as const, results: [{ name: 'Jr. Lampa', lat: -12.05, lng: -77.03 }] }));
    expect(await findPlace('-12.05, -77.03', ask)).toEqual({ ok: true, results: [{ name: '-12.05, -77.03', lat: -12.05, lng: -77.03 }] });
    expect(ask).not.toHaveBeenCalled();
    await findPlace(' Jr. Lampa ', ask, { lat: -12, lng: -77 });
    expect(ask).toHaveBeenCalledWith('Jr. Lampa', { lat: -12, lng: -77 });
  });

  it('a server that does not answer is a message, not an error', async () => {
    expect(await findPlace('Jr. Lampa', async () => { throw new Error('offline'); })).toEqual({ ok: false, message: PLACE_SEARCH_FAILED });
  });
});
