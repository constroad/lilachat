import { describe, expect, it } from 'vitest';
import { workMapOf, type WorkMap } from './workMap.js';

const street = { _id: 's1', name: 'Av. Lima', geometry: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }], lengthM: 108 };

const detailWith = (extra: { partidas?: unknown; tags?: unknown[]; scopes?: unknown[] }) => ({
  partidas: extra.partidas,
  workStreets: { streets: [street], scopes: extra.scopes ?? [], progress: [], tags: extra.tags ?? [], stages: [] },
});

const mapOf = (detail: unknown): WorkMap => {
  const map = workMapOf(detail);
  if (!map) throw new Error('expected a map');
  return map;
};

const namesOf = (map: WorkMap) => map.works.map((work) => work.name);

describe('workMapOf · the service partidas are works with no manual step (José 28/11)', () => {
  it('lists every partida of the contract even when no street carries it yet', () => {
    // Arrange: Pachacamac - Resanes, a new service with its two partidas and nothing drawn on them.
    const detail = detailWith({ partidas: [{ id: 'p1', description: 'Imprimación' }, { id: 'p2', description: 'Colocación' }] });

    // Act
    const map = mapOf(detail);

    // Assert
    expect(namesOf(map)).toEqual(['Imprimación', 'Colocación']);
    expect(map.works.every((work) => work.partida === true)).toBe(true);
  });

  it('does not repeat a partida a person already created by hand, ignoring case and accents', () => {
    const detail = detailWith({
      partidas: [{ id: 'p1', description: 'Imprimación' }, { id: 'p2', description: '  COLOCACION ' }],
      tags: [{ _id: 't1', name: 'imprimacion', color: '#1d4ed8', order: 1 }, { _id: 't2', name: 'Colocación', color: '#111111', order: 2 }],
    });

    const map = mapOf(detail);

    expect(namesOf(map)).toEqual(['imprimacion', 'Colocación']);
    expect(map.works.some((work) => work.partida)).toBe(false);
  });

  it('keeps «Asfaltado» and «Colocación» apart: different names are different works', () => {
    const detail = detailWith({ partidas: [{ id: 'p2', description: 'Colocación' }], tags: [{ _id: 't1', name: 'Asfaltado', color: '#111111', order: 1 }] });

    const map = mapOf(detail);

    expect(namesOf(map)).toEqual(['Asfaltado', 'Colocación']);
  });

  it('keeps a partida a stretch already carries, even if a tag has its name', () => {
    const detail = detailWith({
      partidas: [{ id: 'p1', description: 'Imprimación' }],
      tags: [{ _id: 't1', name: 'Imprimacion', color: '#1d4ed8', order: 1 }],
      scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 100, partidaIds: ['p1'], tagIds: [] }],
    });

    const map = mapOf(detail);

    expect(map.works.map((work) => work.id)).toEqual(['t1', 'p1']);
  });

  it('lists a partida once, whether `_id` or `id`, and skips one without an id', () => {
    const detail = detailWith({
      partidas: [{ _id: 'p1', description: 'Base' }, { description: 'Sin id' }, 'basura', null],
      scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 100, partidaIds: ['p1'], tagIds: [] }],
    });

    const map = mapOf(detail);

    expect(map.works.map((work) => work.id)).toEqual(['p1']);
  });

  it('gives a partida without a description the unnamed label instead of dropping it', () => {
    const map = mapOf(detailWith({ partidas: [{ id: 'p9', description: '' }] }));

    expect(map.works).toHaveLength(1);
    expect(map.works[0]?.id).toBe('p9');
    expect(map.works[0]?.name).not.toBe('');
  });

  it('works with no partidas at all, as before', () => {
    expect(mapOf(detailWith({ partidas: undefined })).works).toEqual([]);
    expect(mapOf(detailWith({ partidas: 'nope' })).works).toEqual([]);
  });

  it('shows the partidas before any street is drawn', () => {
    // Arrange: a service with its contract and no street yet.
    const detail = { partidas: [{ id: 'p1', description: 'Imprimación' }], workStreets: { streets: [], scopes: [], progress: [], tags: [], stages: [] } };

    // Act
    const map = mapOf(detail);

    // Assert
    expect(map.streets).toEqual([]);
    expect(namesOf(map)).toEqual(['Imprimación']);
  });
});
