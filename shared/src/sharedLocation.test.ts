import { describe, expect, it } from 'vitest';
import { accuracyLabel, cleanSharedLocation, locationMapLink, mapTilesFor, ROUTE_MAX_ZOOM, ROUTE_PADDING_PX, routeTilesFor, SHARED_LOCATION_BODY } from './sharedLocation.js';

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

/** Portal 13/11 (visits, lv01): a still map that fits every point of a route. */
describe('routeTilesFor', () => {
  const box = { width: 320, height: 180 };
  const visit = [{ lat: -12.1201, lng: -77.0301, label: '1 · Ingreso' }, { lat: -12.1205, lng: -77.0309, label: '2 · Rampa' }, { lat: -12.1199, lng: -77.0312, label: '3 · Estac.' }];

  it('places every point inside the box, away from the edges', () => {
    // Act
    const map = routeTilesFor(visit, box);
    // Assert
    for (const point of map.points) {
      expect(point.left).toBeGreaterThanOrEqual(ROUTE_PADDING_PX);
      expect(point.left).toBeLessThanOrEqual(box.width - ROUTE_PADDING_PX);
      expect(point.top).toBeGreaterThanOrEqual(ROUTE_PADDING_PX);
      expect(point.top).toBeLessThanOrEqual(box.height - ROUTE_PADDING_PX);
    }
  });

  it('keeps the order and the labels of the points', () => {
    expect(routeTilesFor(visit, box).points.map((point) => point.label)).toEqual(['1 · Ingreso', '2 · Rampa', '3 · Estac.']);
  });

  it('zooms out when the points are far apart', () => {
    const near = routeTilesFor(visit, box).zoom;
    const far = routeTilesFor([{ lat: -12.05, lng: -77.04 }, { lat: -11.95, lng: -76.9 }], box).zoom;
    expect(far).toBeLessThan(near);
  });

  it('a route whose points are all the same spot stays at the closest zoom, centered', () => {
    const map = routeTilesFor([{ lat: -12.1, lng: -77.1 }, { lat: -12.1, lng: -77.1 }], box);
    expect(map.zoom).toBe(ROUTE_MAX_ZOOM);
    expect(map.points[0]).toMatchObject({ left: box.width / 2, top: box.height / 2 });
  });

  it('a visit\'s points, a few meters apart, may come one zoom closer (lv01 audit 14/11: they sat in the middle)', () => {
    const close = [{ lat: -12.0802, lng: -76.9403 }, { lat: -12.0805, lng: -76.9399 }];
    expect(routeTilesFor(close, box).zoom).toBe(ROUTE_MAX_ZOOM);
    expect(routeTilesFor(close, box, ROUTE_MAX_ZOOM + 1).zoom).toBe(ROUTE_MAX_ZOOM + 1);
  });

  it('the tiles cover the whole box', () => {
    const map = routeTilesFor(visit, box);
    expect(Math.min(...map.tiles.map((tile) => tile.left))).toBeLessThanOrEqual(0);
    expect(Math.min(...map.tiles.map((tile) => tile.top))).toBeLessThanOrEqual(0);
    expect(Math.max(...map.tiles.map((tile) => tile.left + 256))).toBeGreaterThanOrEqual(box.width);
    expect(Math.max(...map.tiles.map((tile) => tile.top + 256))).toBeGreaterThanOrEqual(box.height);
    expect(map.tiles.every((tile) => tile.url.startsWith(`https://tile.openstreetmap.org/${map.zoom}/`))).toBe(true);
  });
});
