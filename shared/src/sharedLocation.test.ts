import { describe, expect, it } from 'vitest';
import { accuracyLabel, cleanSharedLocation, locationMapLink, mapTilesFor, SHARED_LOCATION_BODY } from './sharedLocation.js';

describe('a shared location (pending 11)', () => {
  it('keeps a real point, rounded to about 10 cm, with its accuracy in whole meters', () => {
    expect(cleanSharedLocation({ lat: -12.046374123, lng: -77.042793456, accuracy: 12.4 })).toEqual({ ok: true, location: { lat: -12.046374, lng: -77.042793, accuracy: 12 } });
    expect(cleanSharedLocation({ lat: '-12.05', lng: '-77.04' })).toEqual({ ok: true, location: { lat: -12.05, lng: -77.04 } });
    expect(SHARED_LOCATION_BODY).toBe('Ubicación');
  });

  it('refuses what is not a point on Earth, and drops a meaningless accuracy', () => {
    expect(cleanSharedLocation({ lat: 91, lng: 0 })).toEqual({ ok: false, message: 'Esa ubicación no es válida.' });
    expect(cleanSharedLocation({ lat: 0, lng: -181 }).ok).toBe(false);
    expect(cleanSharedLocation({ lat: Number.NaN, lng: 1 }).ok).toBe(false);
    expect(cleanSharedLocation({ lng: 1 }).ok).toBe(false);
    expect(cleanSharedLocation({ lat: 1, lng: 1, accuracy: -5 })).toEqual({ ok: true, location: { lat: 1, lng: 1 } });
    expect(cleanSharedLocation({ lat: 1, lng: 1, accuracy: 99999 })).toEqual({ ok: true, location: { lat: 1, lng: 1 } });
  });

  it('says the accuracy like a person would', () => {
    expect(accuracyLabel(12)).toBe('Precisión 12 m');
    expect(accuracyLabel(1500)).toBe('Precisión 1,5 km');
    expect(accuracyLabel(undefined)).toBe('');
  });

  it('opens in the map app with a universal link', () => {
    expect(locationMapLink({ lat: -12.046374, lng: -77.042793 })).toBe('https://www.google.com/maps/search/?api=1&query=-12.046374%2C-77.042793');
  });

  it('lays the map tiles so the point falls in the middle of the box', () => {
    const map = mapTilesFor({ lat: 0, lng: 0, accuracy: 50 }, { width: 260, height: 140 }, 16);
    expect(map.tiles.map((tile) => tile.url)).toEqual([
      'https://tile.openstreetmap.org/16/32767/32767.png',
      'https://tile.openstreetmap.org/16/32768/32767.png',
      'https://tile.openstreetmap.org/16/32767/32768.png',
      'https://tile.openstreetmap.org/16/32768/32768.png',
    ]);
    expect(map.tiles[0]).toMatchObject({ left: -126, top: -186 });
    expect(map.tiles[3]).toMatchObject({ left: 130, top: 70 });
    expect(map.pin).toEqual({ left: 130, top: 70 });
    expect(map.accuracyRadius).toBe(21);
  });

  it('wraps around the date line', () => {
    const map = mapTilesFor({ lat: 0, lng: 179.9999 }, { width: 260, height: 140 }, 2);
    expect(map.tiles.some((tile) => tile.url.includes('/2/0/'))).toBe(true);
    expect(map.tiles.every((tile) => !tile.url.includes('/2/4/'))).toBe(true);
  });
});
