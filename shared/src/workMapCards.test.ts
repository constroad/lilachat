import { describe, expect, it } from 'vitest';
import { distanceLabel, mapPickAnchor, markCard, markGroupsOf, markSizeLabel, nearestMarks, observationCard, observationMapCollection, observationRowsOf } from './workMapCards.js';
import { workMapMarksOf, type WorkMapMark } from './workMapMarks.js';
import { workMapObservationsOf } from './workMapObservations.js';

/** Metres east of a spot on -12° (1° of longitude there is ~108 766 m). */
const M_PER_DEG_LNG = 108_766;
const east = (meters: number) => ({ lat: -12, lng: -77 + meters / M_PER_DEG_LNG });
const symbol = (id: string, meters: number, type = 'otro', note?: string): unknown => ({ id, type, ...(note ? { note } : {}), shape: { kind: 'symbol', at: east(meters) } });

/** José 19/11: «no quiero ningún botón medir»; the distances come by themselves, in m or km. */
describe('distanceLabel', () => {
  it('metres without decimals under a kilometre, km with one comma decimal from there', () => {
    expect(distanceLabel(35.4)).toBe('35 m');
    expect(distanceLabel(999.4)).toBe('999 m');
    expect(distanceLabel(999.6)).toBe('1,0 km');
    expect(distanceLabel(1234)).toBe('1,2 km');
    expect(distanceLabel(12_560)).toBe('12,6 km');
  });
});

describe('markSizeLabel', () => {
  it('a circle by its diameter, a rect by its sides, a polygon by its area, an arrow by its length', () => {
    // Arrange
    const [circle, rect, polygon, arrow, dot] = workMapMarksOf([
      { id: 'c', type: 'giba', shape: { kind: 'circle', center: east(0), radiusM: 4 } },
      { id: 'r', type: 'otro', shape: { kind: 'rect', corners: [east(0), { lat: -12 + 4 / 111_195, lng: -77 + 12 / M_PER_DEG_LNG }] } },
      { id: 'p', type: 'bocacalle', shape: { kind: 'polygon', points: [east(0), east(10), { lat: -12 + 10 / 111_195, lng: -77 + 10 / M_PER_DEG_LNG }, { lat: -12 + 10 / 111_195, lng: -77 }] } },
      { id: 'a', type: 'sardinel', shape: { kind: 'arrow', from: east(0), to: east(35) } },
      symbol('s', 0, 'poste'),
    ]);
    // Act + Assert
    expect(markSizeLabel(circle!.shape)).toBe('Ø 8 m');
    expect(markSizeLabel(rect!.shape)).toBe('12 × 4 m');
    expect(markSizeLabel(polygon!.shape)).toBe('Área 100 m²');
    expect(markSizeLabel(arrow!.shape)).toBe('Largo 35 m');
    expect(markSizeLabel(dot!.shape)).toBeNull();
  });

  it('a small drawing keeps one decimal, so a manhole cover is not «0 m»', () => {
    const [cover] = workMapMarksOf([{ id: 'c', type: 'tapa', shape: { kind: 'circle', center: east(0), radiusM: 0.3 } }]);
    expect(markSizeLabel(cover!.shape)).toBe('Ø 0,6 m');
  });
});

describe('nearestMarks', () => {
  it('the closest drawings first, without itself, three at most', () => {
    // Arrange
    const marks = workMapMarksOf([symbol('a', 0, 'otro', 'Parche 1'), symbol('b', 35, 'otro', 'Parche 12'), symbol('c', 1200), symbol('d', 80, 'giba'), symbol('e', 5000)]);
    // Act
    const near = nearestMarks(marks[0]!, marks);
    // Assert
    expect(near.map((one) => one.mark.id)).toEqual(['b', 'd', 'c']);
    expect(near.map((one) => one.line)).toEqual(['a 35 m de Parche 12', 'a 80 m de Giba', 'a 1,2 km de Otro']);
  });

  it('a drawing on the same spot is «junto a», and alone there is nothing near', () => {
    const marks = workMapMarksOf([symbol('a', 0), symbol('b', 0.2, 'buzon')]);
    expect(nearestMarks(marks[0]!, marks)[0]!.line).toBe('junto a Buzón');
    expect(nearestMarks(marks[0]!, [marks[0]!])).toEqual([]);
  });
});

describe('markCard', () => {
  it('names the drawing, says its type, its note, its size and what is near', () => {
    // Arrange
    const marks = workMapMarksOf([
      { id: 'a', type: 'giba', note: 'Frente al colegio', shape: { kind: 'circle', center: east(0), radiusM: 2 } },
      symbol('b', 35, 'otro', 'Parche 12'),
    ]);
    // Act
    const card = markCard(marks[0]!, marks);
    // Assert
    expect(card).toMatchObject({ id: 'a', kind: 'mark', title: 'Giba', note: 'Frente al colegio', size: 'Ø 4 m', near: ['a 35 m de Parche 12'], photos: [] });
    expect(card.type).toBeUndefined();
  });

  it('an «Otro» named by its note says it is an «Otro» and does not repeat the note', () => {
    const marks = workMapMarksOf([symbol('b', 35, 'otro', 'Parche 12')]);
    expect(markCard(marks[0]!, marks)).toMatchObject({ title: 'Parche 12', type: 'Otro', near: [] });
    expect(markCard(marks[0]!, marks).note).toBeUndefined();
  });
});

describe('observationCard', () => {
  it('its text, state, dates, how it was solved, its photos and the drawings near', () => {
    // Arrange
    const [observation] = workMapObservationsOf([{ _id: 'o1', text: 'Tapa hundida', status: 'resolved', point: east(0), resolutionNote: 'Nivelada', createdAt: '2026-11-10T15:00:00Z', resolvedAt: '2026-11-12T20:30:00Z', photos: [{ url: 'https://lila.example/a.jpg', thumbnailUrl: 'https://lila.example/a-t.jpg', stage: 'after' }] }]);
    const marks = workMapMarksOf([symbol('b', 20, 'buzon')]);
    // Act
    const card = observationCard(observation!, marks);
    // Assert
    expect(card).toMatchObject({ id: 'o1', kind: 'observation', title: 'Tapa hundida', status: { label: 'Levantada', tone: 'ok' }, dates: ['Registrada 10/11 · 10:00', 'Levantada 12/11 · 15:30'], note: 'Nivelada', near: ['a 20 m de Buzón'] });
    expect(card.photos).toEqual([{ url: 'https://lila.example/a.jpg', thumbUrl: 'https://lila.example/a-t.jpg', mime: 'image/jpeg', name: 'Después · Tapa hundida' }]);
  });

  it('a pending one without place nor dates says only what it is', () => {
    const [observation] = workMapObservationsOf([{ _id: 'o2', text: 'Fisura', status: 'open' }]);
    expect(observationCard(observation!, [])).toMatchObject({ status: { label: 'Pendiente', tone: 'error' }, dates: [], near: [] });
  });
});

describe('the lists of the panel', () => {
  it('drawings grouped by type, the most numerous first, each one by its name', () => {
    // Arrange
    const marks = workMapMarksOf([symbol('a', 0, 'otro', 'Parche 1'), symbol('b', 10, 'giba'), symbol('c', 20, 'otro', 'Parche 2')]);
    // Act
    const groups = markGroupsOf(marks);
    // Assert
    expect(groups.map((group) => [group.label, group.count])).toEqual([['Otro', 2], ['Giba', 1]]);
    expect(groups[0]!.items.map((item) => item.name)).toEqual(['Parche 1', 'Parche 2']);
  });

  it('observations open first, with their pill, photos and whether they can be found on the map', () => {
    // Arrange
    const observations = workMapObservationsOf([
      { _id: 'o1', text: 'Tapa', status: 'resolved', point: east(0) },
      { _id: 'o2', text: 'Fisura', status: 'open', photos: [{ url: 'https://lila.example/a.jpg' }] },
    ]);
    // Act
    const rows = observationRowsOf(observations);
    // Assert
    expect(rows).toEqual([
      { id: 'o2', text: 'Fisura', status: { label: 'Pendiente', tone: 'error' }, photos: '1 foto', placed: false },
      { id: 'o1', text: 'Tapa', status: { label: 'Levantada', tone: 'ok' }, photos: 'Sin fotos', placed: true },
    ]);
  });
});

describe('on the map', () => {
  it('each placed observation is a pin with the color of its state', () => {
    const observations = workMapObservationsOf([{ _id: 'o1', text: 'Tapa', status: 'resolved', point: east(0) }, { _id: 'o2', text: 'Fisura', status: 'open' }, { _id: 'o3', text: 'Bache', status: 'open', point: east(5) }]);
    const collection = observationMapCollection(observations);
    expect(collection.features.map((feature) => [feature.properties.id, feature.properties.color])).toEqual([['o3', '#dc2626'], ['o1', '#16a34a']]);
  });

  it('a pick is anchored at the centre of its drawing or at its observation', () => {
    // Arrange
    const marks: WorkMapMark[] = workMapMarksOf([{ id: 'r', type: 'otro', shape: { kind: 'rect', corners: [{ lat: -12, lng: -77 }, { lat: -12.002, lng: -77.004 }] } }]);
    const observations = workMapObservationsOf([{ _id: 'o1', text: 'Tapa', status: 'open', point: east(0) }, { _id: 'o2', text: 'Sin lugar', status: 'open' }]);
    // Act + Assert
    expect(mapPickAnchor({ kind: 'mark', id: 'r' }, marks, observations)).toEqual({ lat: expect.closeTo(-12.001, 9), lng: expect.closeTo(-77.002, 9) });
    expect(mapPickAnchor({ kind: 'observation', id: 'o1' }, marks, observations)).toEqual(east(0));
    expect(mapPickAnchor({ kind: 'observation', id: 'o2' }, marks, observations)).toBeNull();
    expect(mapPickAnchor({ kind: 'mark', id: 'nope' }, marks, observations)).toBeNull();
  });
});
