import { describe, expect, it } from 'vitest';
import { workMapOf, type WorkMap } from './workMap.js';
import type { ByApproveList } from './workByApprove.js';
import { FEED_PILL, FEED_RANGES, feedCounts, feedInRange, feedSummaryOf, feedWhen, progressFeedOf } from './workProgressFeed.js';

/** Design ma05 (José 28/11): every progress of the work, today, this week or all, with its state. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const TODAY = '2026-11-28';

const mapOf = (): WorkMap => {
  const map = workMapOf({
    workStreets: {
      streets: [{ _id: 's1', name: 'Jr. Progreso', geometry: line, lengthM: 284, widthM: 6 }, { _id: 's2', name: 'Av. Lima', geometry: line, lengthM: 400 }],
      scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 284, tagIds: ['imp', 'car'], partidaIds: [] }],
      progress: [
        { streetId: 's1', tagId: 'car', fromM: 0, toM: 60, date: '2026-11-27' },
        { streetId: 's1', tagId: 'imp', fromM: 0, toM: 40, date: '2026-11-01' },
      ],
      tags: [{ _id: 'imp', name: 'Imprimación', color: '#d97706', order: 1 }, { _id: 'car', name: 'Carpeta 2"', color: '#2563eb', order: 2 }],
      stages: [],
    },
  });
  if (!map) throw new Error('expected a map');
  return map;
};

const list: ByApproveList = {
  total: 4,
  items: [
    { id: 'a2', state: 'pendiente', date: TODAY, streetId: 's1', fromM: 120, toM: 166, workId: 'imp', quantity: 46, author: 'Juan Quispe', own: true, rejectNote: null },
    { id: 'a1', state: 'pendiente', date: TODAY, streetId: 's2', fromM: 330, toM: 410, workId: 'imp', quantity: 80, author: 'Juan Quispe', own: false, rejectNote: null },
    { id: 'a0', state: 'pendiente', date: '2026-11-26', streetId: 's1', fromM: 100, toM: 120, workId: 'imp', quantity: 20, author: 'Juan Quispe', own: true, rejectNote: null },
    { id: 'r1', state: 'rechazado', date: '2026-11-27', streetId: 's1', fromM: 0, toM: 40, workId: 'imp', quantity: 40, author: 'Rosa Huamán', own: false, rejectNote: 'La foto no muestra el tramo' },
  ],
};

describe('ma05: the feed', () => {
  it('merges what waits, what was refused and what was approved, newest first', () => {
    // Arrange / Act
    const cards = progressFeedOf(mapOf(), list, TODAY);
    // Assert
    expect(cards.map((card) => card.state)).toEqual(['pendiente', 'pendiente', 'rechazado', 'aprobado', 'pendiente', 'aprobado']);
    expect(cards[0]).toMatchObject({ id: 'a2', title: 'Imprimación · Jr. Progreso', color: '#d97706', stretch: '0+120 → 0+166', meters: '46 m', area: '276 m²', when: 'Hoy', author: 'Juan Quispe', pill: '', undoable: true, toM: 166 });
    expect(cards[1]).toMatchObject({ title: 'Imprimación · Av. Lima', area: null, undoable: false });
    expect(cards[2]).toMatchObject({ pill: 'DESHECHO', rejectNote: 'La foto no muestra el tramo', when: 'Ayer' });
    expect(cards[3]).toMatchObject({ title: 'Carpeta 2" · Jr. Progreso', pill: '', author: null, meters: '60 m' });
    expect(FEED_PILL).toEqual({ pendiente: '', aprobado: '', rechazado: 'DESHECHO' });
  });

  it('«Deshacer» for anyone only on the newest own pending one of each street and work', () => {
    const cards = progressFeedOf(mapOf(), list, TODAY);
    expect(cards.filter((card) => card.undoable).map((card) => card.id)).toEqual(['a2']);
  });

  it('an admin undoes any record that counts and has an id, never one already undone (José 28/11)', () => {
    // Arrange: Portal sends the id of what is done; the first one has it.
    const map = mapOf();
    const withId: WorkMap = { ...map, progress: [{ ...map.progress[0]!, id: 'p9' }, map.progress[1]!] };
    // Act
    const cards = progressFeedOf(withId, list, TODAY, true);
    // Assert
    expect(cards.filter((card) => card.undoable).map((card) => card.id)).toEqual(['a2', 'a1', 'p9', 'a0']);
  });

  it('lists once a pending record the map already counts', () => {
    // Arrange: the map with what Portal keeps pending folded in, as the boards pass it.
    const map = mapOf();
    const folded: WorkMap = { ...map, progress: [...map.progress, { id: 'a2', streetId: 's1', workId: 'imp', fromM: 120, toM: 166, date: TODAY, rework: false }] };
    // Act
    const cards = progressFeedOf(folded, list, TODAY);
    // Assert
    expect(cards.filter((card) => card.id === 'a2')).toHaveLength(1);
    expect(cards).toHaveLength(6);
  });

  it('without the list (an older Portal) it still shows what was approved', () => {
    expect(progressFeedOf(mapOf(), null, TODAY).map((card) => card.state)).toEqual(['aprobado', 'aprobado']);
  });

  it('a progress without stretch or of a work gone still reads', () => {
    const odd: ByApproveList = { total: 1, items: [{ id: 'x', state: 'pendiente', date: '', streetId: null, fromM: null, toM: null, workId: 'gone', quantity: 12, author: null, own: true, rejectNote: null }] };
    expect(progressFeedOf({ ...mapOf(), progress: [] }, odd, TODAY)[0]).toMatchObject({ title: 'Trabajo · Calle sin nombre', stretch: '', meters: '12 m', when: '', undoable: false });
  });
});

describe('ma05: Hoy / Semana / Todo', () => {
  it('filters by Lima day; the week is the last seven days; an undated one only in «Todo»', () => {
    const cards = progressFeedOf(mapOf(), list, TODAY);
    expect(feedInRange(cards, 'hoy', TODAY).map((card) => card.id)).toEqual(['a2', 'a1']);
    expect(feedInRange(cards, 'semana', TODAY)).toHaveLength(5);
    expect(feedInRange(cards, 'todo', TODAY)).toHaveLength(6);
    expect(feedCounts(cards, TODAY)).toEqual({ hoy: 2, semana: 5, todo: 6 });
    expect(FEED_RANGES.map((range) => range.label)).toEqual(['Hoy', 'Semana', 'Todo']);
  });

  it('the week crosses a month boundary', () => {
    const cards = progressFeedOf(mapOf(), { total: 1, items: [{ ...list.items[0]!, date: '2026-11-25' }] }, '2026-12-01');
    expect(feedInRange(cards, 'semana', '2026-12-01').map((card) => card.id)).toEqual(['aprobado-s1-car-0', 'a2']);
    expect(feedInRange(cards, 'semana', '2026-12-03').map((card) => card.id)).toEqual(['aprobado-s1-car-0']);
  });

  it('the summary adds metres and m² of what is not refused', () => {
    const cards = feedInRange(progressFeedOf(mapOf(), list, TODAY), 'hoy', TODAY);
    expect(feedSummaryOf(cards)).toEqual({ meters: '126', area: '276', count: '2 avances' });
    expect(feedSummaryOf([])).toEqual({ meters: '0', area: null, count: '0 avances' });
    expect(feedSummaryOf(cards.slice(0, 1)).count).toBe('1 avance');
  });

  it('«Hoy», «Ayer» or the day', () => {
    expect(feedWhen(TODAY, TODAY)).toBe('Hoy');
    expect(feedWhen('2026-11-27', TODAY)).toBe('Ayer');
    expect(feedWhen('2026-11-20', TODAY)).toBe('20 nov');
    expect(feedWhen('', TODAY)).toBe('');
  });
});
