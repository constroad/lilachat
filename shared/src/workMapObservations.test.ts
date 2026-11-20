import { describe, expect, it } from 'vitest';
import { workMapObservationsOf } from './workMapObservations.js';
import { workMapOf, workMapView, WORK_MAP_MIN_FRAME_DEG } from './workMap.js';

/** José 19/11: Portal adds `workObservations` to the client detail; the map shows them as pins. */
describe('workMapObservationsOf', () => {
  it('keeps what Portal sends, open first, and leaves a broken one out', () => {
    // Arrange
    const raw = [
      { _id: 'o1', text: 'Tapa hundida', status: 'resolved', point: { lat: -12.05, lng: -77.03 }, resolutionNote: 'Nivelada', createdAt: '2026-11-10T15:00:00Z', resolvedAt: '2026-11-12T15:00:00Z' },
      { _id: 'o2', text: 'Fisura en la junta', status: 'open', streetId: 's1', fromM: 40, toM: 60, photos: [{ url: 'https://lila.example/a.jpg', thumbnailUrl: 'https://lila.example/a-t.jpg', stage: 'before' }] },
      { _id: 'o3', text: '', status: 'open' },
      { text: 'Sin id', status: 'open' },
      { _id: 'o4', text: 'Estado raro', status: 'archived' },
    ];
    // Act
    const observations = workMapObservationsOf(raw);
    // Assert
    expect(observations.map((one) => one.id)).toEqual(['o2', 'o1']);
    expect(observations[0]).toMatchObject({ status: 'open', streetId: 's1', fromM: 40, toM: 60, photos: [{ url: 'https://lila.example/a.jpg', thumbnailUrl: 'https://lila.example/a-t.jpg', stage: 'before' }] });
    expect(observations[1]).toMatchObject({ status: 'resolved', point: { lat: -12.05, lng: -77.03 }, resolutionNote: 'Nivelada', resolvedAt: '2026-11-12T15:00:00Z' });
  });

  it('only https photos reach a screen, and a point off the globe is no point', () => {
    // Arrange
    const raw = [{ _id: 'o1', text: 'Bache', status: 'open', point: { lat: 120, lng: -77 }, photos: [{ url: 'http://x/a.jpg' }, { url: 'javascript:alert(1)' }, { url: 'https://lila.example/b.jpg', thumbnailUrl: 'http://x/t.jpg', stage: 'later' }] }];
    // Act
    const [observation] = workMapObservationsOf(raw);
    // Assert
    expect(observation!.point).toBeUndefined();
    expect(observation!.photos).toEqual([{ url: 'https://lila.example/b.jpg' }]);
  });

  it('caps the text and the photos', () => {
    // Arrange
    const photos = Array.from({ length: 30 }, (_unused, index) => ({ url: `https://lila.example/${index}.jpg` }));
    // Act
    const [observation] = workMapObservationsOf([{ _id: 'o1', text: 'x'.repeat(2000), status: 'open', photos }]);
    // Assert
    expect(observation!.text.length).toBe(600);
    expect(observation!.photos.length).toBe(12);
  });

  it('nothing, or not a list, is no observations', () => {
    expect(workMapObservationsOf(undefined)).toEqual([]);
    expect(workMapObservationsOf({ _id: 'o1' })).toEqual([]);
  });
});

describe('a service with observations only', () => {
  it('is a map framed on its observations', () => {
    // Arrange
    const detail = { workStreets: null, workObservations: [{ _id: 'o1', text: 'Bache', status: 'open', point: { lat: -12.05, lng: -77.03 } }] };
    // Act
    const map = workMapOf(detail);
    // Assert
    expect(map).toMatchObject({ streets: [], observations: [{ id: 'o1' }] });
    // A lone point is framed with the minimum span (José 19/11: never at full zoom).
    expect(workMapView(map!).bounds).toEqual([[-77.03 - WORK_MAP_MIN_FRAME_DEG / 2, -12.05 - WORK_MAP_MIN_FRAME_DEG / 2], [-77.03 + WORK_MAP_MIN_FRAME_DEG / 2, -12.05 + WORK_MAP_MIN_FRAME_DEG / 2]]);
  });

  it('streets keep their observations too', () => {
    // Arrange
    const detail = { workStreets: { streets: [{ _id: 's1', name: 'Av. Uno', geometry: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }] }] }, workObservations: [{ _id: 'o1', text: 'Bache', status: 'open' }] };
    // Act
    const map = workMapOf(detail);
    // Assert
    expect(map?.observations?.map((one) => one.id)).toEqual(['o1']);
  });

  it('a stretch observation is pinned at the middle of its stretch, on its street', () => {
    // Arrange: Av. Uno runs east along -12; 1° of longitude there is ~108 766 m.
    const street = { _id: 's1', name: 'Av. Uno', geometry: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }] };
    const detail = { workStreets: { streets: [street] }, workObservations: [{ _id: 'o1', text: 'Fisura', status: 'open', streetId: 's1', fromM: 100, toM: 300 }, { _id: 'o2', text: 'Otra calle', status: 'open', streetId: 'nope', fromM: 10 }] };
    // Act
    const [onStreet, lost] = workMapOf(detail)!.observations!;
    // Assert
    expect(onStreet!.point!.lat).toBeCloseTo(-12, 6);
    expect((onStreet!.point!.lng + 77) * 108_766).toBeCloseTo(200, 0);
    expect(lost!.point).toBeUndefined();
  });
});
