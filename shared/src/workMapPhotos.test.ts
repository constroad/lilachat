import { describe, expect, it } from 'vitest';
import type { WorkMap, WorkMapPoint } from './workMap.js';
import { mapPhotosOf, photoSourceLabel, photoSpotFiles, photoLayerFiles, photoSpotPins, photoSpotsOf, photoSpotTitle, type MapPhoto } from './workMapPhotos.js';

/** José 08/11: «en el mapa, en la calle X, si activo ese CTA debería tener un marcador para ver las fotos y videos». */
const METERS_PER_DEGREE = 111_195;
const START: WorkMapPoint = { lat: -12.05, lng: -77.03 };
const north = (meters: number, sideM = 0): WorkMapPoint => ({ lat: START.lat + meters / METERS_PER_DEGREE, lng: START.lng + sideM / (METERS_PER_DEGREE * Math.cos((START.lat * Math.PI) / 180)) });
const STREET_ID = '6aee73fa80fb948f67e89b8c';
const map: WorkMap = { streets: [{ id: STREET_ID, name: 'Jr. Los Pinos', line: [north(0), north(320)], lengthM: 320 }], scopes: [], progress: [], works: [], stages: [] };

const photo = (id: string, at: WorkMapPoint, extra: Partial<MapPhoto> = {}): MapPhoto => ({ id, ...at, at: '2026-11-06T14:05:00.000Z', kind: 'photo', url: `https://lila.test/${id}.jpg`, thumbnailUrl: `https://lila.test/${id}-t.jpg`, reportType: 'CTL-PIS', ...extra });

describe('mapPhotosOf, what Portal sends', () => {
  it('keeps only photos with a place and a link, and drops what the map does not use', () => {
    const raw = [
      { id: 'a1', lat: -12.05, lng: -77.03, at: '2026-11-06T14:05:00.000Z', kind: 'video', url: 'https://lila.test/a1.mp4', thumbnailUrl: 'https://lila.test/a1.jpg', reportType: 'CTL-IMP', plate: 'QAA-001', secret: 'x' },
      { id: 'a2', lat: 'x', lng: -77.03, url: 'https://lila.test/a2.jpg' },
      { id: 'a3', lat: -12.05, lng: -77.03, at: '2026-11-06T14:05:00.000Z' },
      'basura',
    ];
    const photos = mapPhotosOf(raw);
    expect(photos).toEqual([{ id: 'a1', lat: -12.05, lng: -77.03, at: '2026-11-06T14:05:00.000Z', kind: 'video', url: 'https://lila.test/a1.mp4', thumbnailUrl: 'https://lila.test/a1.jpg', reportType: 'CTL-IMP', plate: 'QAA-001' }]);
    expect(mapPhotosOf(undefined)).toEqual([]);
  });
});

describe('photoSpotsOf, one marker per spot of the street', () => {
  it('photos a few meters apart on the same street share a marker, labelled with its chainage', () => {
    const spots = photoSpotsOf(map, [photo('p1', north(40)), photo('p2', north(48, 3)), photo('p3', north(200))]);
    expect(spots.map((spot) => [photoSpotTitle(spot), spot.photos.map((one) => one.id)])).toEqual([
      ['Jr. Los Pinos · 0+044', ['p1', 'p2']],
      ['Jr. Los Pinos · 0+200', ['p3']],
    ]);
  });

  it('a photo far from every street gets its own marker, said as such', () => {
    const [spot] = photoSpotsOf(map, [photo('p9', north(100, 150))]);
    expect(spot!.streetId).toBeNull();
    expect(photoSpotTitle(spot!)).toBe('Fuera de las calles de la obra');
  });

  it('the newest photo goes first inside a spot', () => {
    const [spot] = photoSpotsOf(map, [photo('old', north(40), { at: '2026-11-05T14:00:00.000Z' }), photo('new', north(42), { at: '2026-11-06T14:00:00.000Z' })]);
    expect(spot!.photos.map((one) => one.id)).toEqual(['new', 'old']);
  });

  it('a pin per spot, numbered by how many photos it holds', () => {
    const pins = photoSpotPins(photoSpotsOf(map, [photo('p1', north(40)), photo('p2', north(45))]));
    expect(pins).toEqual([expect.objectContaining({ label: '2', outside: false, icon: 'photo' })]);
  });
});

describe('photoSourceLabel, where a photo came from', () => {
  it('names the report and the unit', () => {
    expect(photoSourceLabel(photo('p1', north(0), { plate: 'QAA-001' }))).toBe('Control de pista · QAA-001');
    expect(photoSourceLabel(photo('p1', north(0), { reportType: 'CTL-IMP' }))).toBe('Control de imprimación');
    expect(photoSourceLabel(photo('p1', north(0), { reportType: undefined }))).toBe('Avance registrado');
    // A unit's photo that came without its report (web E2E 08/11 said «Avance registrado»).
    expect(photoSourceLabel(photo('p1', north(0), { reportType: undefined, plate: 'QAA-001' }))).toBe('Unidad QAA-001');
  });
});

describe('photoSpotFiles, for the viewer', () => {
  it('a video stays a video, each named by its source', () => {
    const [spot] = photoSpotsOf(map, [photo('v1', north(40), { kind: 'video', plate: 'QAA-002' })]);
    expect(photoSpotFiles(spot!)).toEqual([{ url: 'https://lila.test/v1.jpg', name: 'Control de pista · QAA-002 · Jr. Los Pinos · 0+040', mime: 'video/mp4', thumbUrl: 'https://lila.test/v1-t.jpg', when: '2026-11-06T14:05:00.000Z' }]);
  });
});

describe('the «Fotos» pins show what they hold (José 09/11: bare numbers confused)', () => {
  it('a film when every one is a video, a camera otherwise', () => {
    // Arrange
    const spot = (kinds: Array<'photo' | 'video'>) => ({ id: 's', lat: -12, lng: -77, streetId: 'x', streetName: null, atM: null, photos: kinds.map((kind, index) => ({ id: `p${index}`, lat: -12, lng: -77, at: '2026-11-09T12:00:00.000Z', kind, url: 'https://x', thumbnailUrl: 'https://x' })) });
    // Act / Assert
    expect(photoSpotPins([spot(['video', 'video'])] as never)[0]?.icon).toBe('video');
    expect(photoSpotPins([spot(['video', 'photo'])] as never)[0]?.icon).toBe('photo');
  });
});

/** José 09/11: «el visor me debería poder navegar entre todos los puntos de fotos». */
describe('photoLayerFiles, the viewer over every spot', () => {
  const spot = (id: string, urls: string[]) => ({ id, streetName: 'Jr. A', atM: 10, photos: urls.map((url) => ({ url, kind: 'photo' as const, at: '2026-11-09T10:00:00.000Z' })) });
  const spots = [spot('a', ['https://x/1.jpg', 'https://x/2.jpg']), spot('b', ['https://x/3.jpg'])];
  it('opens on the tapped spot and swipes through all of them in map order', () => {
    const opened = photoLayerFiles(spots as never, 'fotos-b');
    expect(opened?.first.url).toBe('https://x/3.jpg');
    expect(opened?.all.map((file) => file.url)).toEqual(['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
    // The same object as in the list: the viewer finds it even if two photos share an address.
    expect(opened?.all.indexOf(opened.first)).toBe(2);
  });
  it('gives nothing for a pin that is not a spot', () => {
    expect(photoLayerFiles(spots as never, 'fotos-z')).toBeNull();
  });
});
