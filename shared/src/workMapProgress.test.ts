import { describe, expect, it } from 'vitest';
import type { SuggestedStretch } from './workMapDischarges.js';
import { dischargePinCollection, dischargePinsOf, dischargeRowsOf, dischargesOf, NO_PLATE, progressEntryOf, stretchLineOf, stretchLinesOf, stretchWorksOf, usefulWidthLabel } from './workMapProgress.js';

/** Portal's `discharges` (07/11): snake_case, ISO hours in UTC, points sorted by `at`. */
const raw = (overrides: Record<string, unknown> = {}) => ({
  dispatch_id: '6aeef89f31485f2908446b9e',
  plate: 'QAP-101',
  m3: 15,
  arrival_at: '2026-11-07T14:00:00.000Z',
  finished_at: '2026-11-07T14:15:00.000Z',
  points: [
    { kind: 'ingreso', lat: -12.05, lng: -77.03, precision_m: 6, at: '2026-11-07T14:00:00.000Z' },
    { kind: 'vacia', lat: -12.0497, lng: -77.03, precision_m: 9, at: '2026-11-07T14:15:00.000Z' },
  ],
  ...overrides,
});

describe('dischargesOf (Portal sends them in the service detail)', () => {
  it('keeps what the map needs, in its own words', () => {
    expect(dischargesOf([raw()])).toEqual([{
      dispatchId: '6aeef89f31485f2908446b9e',
      plate: 'QAP-101',
      m3: 15,
      arrivalAt: '2026-11-07T14:00:00.000Z',
      points: [
        { kind: 'ingreso', lat: -12.05, lng: -77.03, precisionM: 6, at: '2026-11-07T14:00:00.000Z' },
        { kind: 'vacia', lat: -12.0497, lng: -77.03, precisionM: 9, at: '2026-11-07T14:15:00.000Z' },
      ],
    }]);
  });

  it('a unit without plate gets a label, and a photo without kind still says where', () => {
    const [unit] = dischargesOf([raw({ plate: '', m3: undefined, arrival_at: undefined, points: [{ kind: '', lat: -12.05, lng: -77.03, at: '2026-11-07T14:00:00.000Z' }] })]);
    expect(unit).toMatchObject({ plate: NO_PLATE, m3: null, arrivalAt: null });
    expect(unit?.points).toEqual([{ kind: '', lat: -12.05, lng: -77.03, at: '2026-11-07T14:00:00.000Z' }]);
  });

  it('drops what cannot be drawn: no id, broken places and hours', () => {
    const units = dischargesOf([
      raw({ dispatch_id: '' }),
      raw({ points: [{ kind: 'ingreso', lat: 120, lng: -77, at: '2026-11-07T14:00:00.000Z' }, { kind: 'vacia', lat: -12, lng: -77, at: 'ayer' }, 'x'] }),
      'basura',
    ]);
    expect(units).toHaveLength(1);
    expect(units[0]?.points).toEqual([]);
  });

  it('caps 100 units and 20 points each, and anything else is no list', () => {
    const many = Array.from({ length: 120 }, (_, index) => raw({ dispatch_id: `d${index}`, points: Array.from({ length: 25 }, () => raw().points[0]) }));
    const units = dischargesOf(many);
    expect(units).toHaveLength(100);
    expect(units[0]?.points).toHaveLength(20);
    expect(dischargesOf(undefined)).toEqual([]);
    expect(dischargesOf({ dispatch_id: 'x' })).toEqual([]);
  });
});

const stretch: SuggestedStretch = { streetId: '6aee73fa80fb948f67e89b8c', streetName: 'Calle QA', fromM: 10, toM: 100, lengthM: 90, volumeM3: 45, dispatchIds: ['a', 'b', 'c'] };
const tag = { id: '6aeef89e31485f2908446b9b', name: 'Asfalto QA', color: '#2563eb' };
const NOW = new Date('2026-11-07T15:00:00.000Z');
const draft = { serviceId: '6aedcc3a2f5e395dca260f16', stretch, fromM: 10, toM: 100, work: tag, entryId: '3f0e2c1a-1111-4222-8333-444455556666', now: NOW, streetLengthM: 190.61 };

describe('progressEntryOf (the form of registrar_avance_de_obra)', () => {
  it('fills the tool with the stretch, its units and the tag, and no date', () => {
    expect(progressEntryOf(draft)).toEqual({ ok: true, entry: {
      servicioId: '6aedcc3a2f5e395dca260f16',
      calleId: '6aee73fa80fb948f67e89b8c',
      etiquetaId: '6aeef89e31485f2908446b9b',
      desdeM: 10,
      hastaM: 100,
      despachoIds: ['a', 'b', 'c'],
      entradaId: '3f0e2c1a-1111-4222-8333-444455556666',
      horaDelEquipo: '2026-11-07T15:00:00.000Z',
    } });
  });

  it('a contracted item goes as partidaId, and a note is trimmed to 280', () => {
    const reply = progressEntryOf({ ...draft, work: { ...tag, partida: true }, note: `  ${'a'.repeat(300)}  ` });
    expect(reply.ok && reply.entry.partidaId).toBe(tag.id);
    expect(reply.ok && reply.entry.etiquetaId).toBeUndefined();
    expect(reply.ok && reply.entry.nota).toHaveLength(280);
  });

  it('the person adjusts the stretch: whole meters, inside the street', () => {
    const reply = progressEntryOf({ ...draft, fromM: 12.4, toM: 98.6 });
    expect(reply.ok && [reply.entry.desdeM, reply.entry.hastaM]).toEqual([12, 99]);
  });

  it('never sends an end past what Portal accepts: the street plus half a meter (Portal 07/11)', () => {
    // Arrange: a street of 198.3 m; Portal refuses an end over 198.8.
    const short = { ...draft, streetLengthM: 198.3 };

    // Act
    const rounded = progressEntryOf({ ...short, toM: 198.6 });
    const typed = progressEntryOf({ ...short, toM: 199 });
    const edge = progressEntryOf({ ...draft, toM: 191 });

    // Assert
    expect(rounded.ok && rounded.entry.hastaM).toBe(198);
    expect(typed).toEqual({ ok: false, message: 'El tramo pasa el largo de la calle (198 m).' });
    expect(edge.ok && edge.entry.hastaM).toBe(191);
  });

  it('refuses what Portal would refuse, in words the person reads', () => {
    expect(progressEntryOf({ ...draft, work: undefined })).toEqual({ ok: false, message: 'Elige el trabajo que se hizo en el tramo.' });
    expect(progressEntryOf({ ...draft, fromM: 100, toM: 100 })).toEqual({ ok: false, message: 'El final del tramo tiene que ir después del inicio.' });
    expect(progressEntryOf({ ...draft, toM: 250 })).toEqual({ ok: false, message: 'El tramo pasa el largo de la calle (191 m).' });
    expect(progressEntryOf({ ...draft, fromM: -5 })).toEqual({ ok: false, message: 'El tramo pasa el largo de la calle (191 m).' });
    expect(progressEntryOf({ ...draft, stretch: { ...stretch, dispatchIds: [] } })).toEqual({ ok: false, message: 'Este tramo no tiene unidades que lo respalden.' });
    expect(progressEntryOf({ ...draft, stretch: { ...stretch, dispatchIds: Array.from({ length: 31 }, (_, index) => `d${index}`) } })).toEqual({ ok: false, message: 'Máximo 30 unidades por avance.' });
  });
});

describe('dischargeRowsOf (the list of design o-07)', () => {
  it('numbers the units by arrival and says where each one went, in Lima time', () => {
    // Arrange
    const unit = (dispatchId: string, plate: string, m3: number | null) => ({ dispatchId, plate, m3, arrivalAt: '2026-11-07T14:20:00.000Z', points: [] });
    const suggestion = { stretches: [], units: [
      { state: 'placed' as const, unit: unit('a', 'QAP-101', 15), streetId: 's1', fromM: 10, toM: 40 },
      { state: 'outside' as const, unit: unit('d', 'QAP-104', 7.5), point: { lat: -12, lng: -77 } },
      { state: 'noPlace' as const, unit: { ...unit('e', NO_PLATE, null), arrivalAt: null } },
    ] };
    // Act
    const rows = dischargeRowsOf(suggestion);
    // Assert
    expect(rows).toEqual([
      { dispatchId: 'a', number: 1, title: 'Unidad 1 · QAP-101', line: '09:20 · 15 m³ · 0+010 a 0+040', state: 'placed' },
      { dispatchId: 'd', number: 2, title: 'Unidad 2 · QAP-104', line: '09:20 · 7,5 m³ · Fuera de la obra', state: 'outside' },
      { dispatchId: 'e', number: 3, title: 'Unidad 3 · Sin placa', line: 'Sin lugar en sus fotos', state: 'noPlace' },
    ]);
  });
});

describe('stretchWorksOf', () => {
  it('offers the works planned on that street, so the person picks one of them', () => {
    const map = { streets: [], progress: [], stages: [], scopes: [{ streetId: 's1', fromM: 0, toM: 120, workIds: ['t1'] }, { streetId: 's2', fromM: 0, toM: 50, workIds: ['t2'] }], works: [{ id: 't1', name: 'Asfalto QA', color: '#2563eb' }, { id: 't2', name: 'Base', color: '#b45309' }] };
    expect(stretchWorksOf(map, 's1').map((work) => work.id)).toEqual(['t1']);
    expect(stretchWorksOf(map, 's3')).toEqual([]);
  });
});

describe('dischargePinsOf and stretchLineOf (what the canvas draws)', () => {
  it('pins each unit where its last photo was, numbered, and the outside one apart', () => {
    const unit = (dispatchId: string, lat: number) => ({ dispatchId, plate: 'X', m3: 1, arrivalAt: null, points: [{ kind: 'ingreso', lat, lng: -77, at: '2026-11-07T14:00:00.000Z' }, { kind: 'vacia', lat: lat + 0.001, lng: -77, at: '2026-11-07T14:15:00.000Z' }] });
    const pins = dischargePinsOf({ units: [
      { state: 'placed', unit: unit('a', -12), streetId: 's1', fromM: 0, toM: 100 },
      { state: 'outside', unit: unit('d', -11.99), point: { lat: -11.98, lng: -77 } },
      { state: 'noPlace', unit: { ...unit('e', -12), points: [] } },
    ] });
    expect(pins).toEqual([{ id: 'a', label: '1', lat: -11.999, lng: -77, outside: false }, { id: 'd', label: '2', lat: -11.98, lng: -77, outside: true }]);
  });

  it('draws the stretch the person is about to confirm', () => {
    const map = { streets: [{ id: 's1', name: 'Calle', line: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }], lengthM: 1090 }] };
    const line = stretchLineOf(map, 's1', 0, 545);
    expect(line?.coordinates[0]).toEqual([-77, -12]);
    expect(line?.coordinates.at(-1)?.[0]).toBeCloseTo(-76.995, 3);
    expect(stretchLineOf(map, 'nope', 0, 10)).toBeNull();
  });
});

describe('dischargePinCollection (the APK draws pins as a layer)', () => {
  it('turns each pin into a point with its number and its color', () => {
    const collection = dischargePinCollection([{ id: 'a', label: '1', lat: -12, lng: -77, outside: false }, { id: 'd', label: '2', lat: -11.98, lng: -77, outside: true }]);
    expect(collection.features.map((feature) => [feature.properties, feature.geometry.coordinates])).toEqual([
      [{ id: 'a', label: '1', color: '#7c3aed' }, [-77, -12]],
      [{ id: 'd', label: '2', color: '#dc2626' }, [-77, -11.98]],
    ]);
  });
});

describe('stretchLinesOf', () => {
  it('draws each suggested stretch, or the range the person adjusted', () => {
    const map = { streets: [{ id: 's1', name: 'Calle', line: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }], lengthM: 1090 }] };
    const stretches = [{ streetId: 's1', streetName: 'Calle', fromM: 0, toM: 100, lengthM: 100, volumeM3: 1, dispatchIds: ['a'] }, { streetId: 'gone', streetName: 'X', fromM: 0, toM: 1, lengthM: 1, volumeM3: 0, dispatchIds: ['b'] }];
    const lines = stretchLinesOf(map, stretches, { s1: { fromM: 50, toM: 60 } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ streetId: 's1', fromM: 50, toM: 60 });
  });
});

describe('usefulWidthLabel (audit 08/11 item 20: o-07 shows the width the m² come from)', () => {
  const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.998 }];
  const map = { streets: [{ id: 's1', name: 'A', line, lengthM: 218, widthM: 6 }, { id: 's2', name: 'B', line, lengthM: 218 }], scopes: [{ id: 'c1', streetId: 's1', fromM: 100, toM: 218, workIds: ['w'], widthM: 4.5 }] };

  it('the stretch\'s width where the range starts, else the street\'s, with the area it gives', () => {
    expect(usefulWidthLabel(map, 's1', { fromM: 120, toM: 160 })).toBe('4,5 m · 180 m²');
    expect(usefulWidthLabel(map, 's1', { fromM: 0, toM: 50 })).toBe('6,0 m · 300 m²');
  });

  it('says when the street has no width, the case Portal refuses', () => {
    expect(usefulWidthLabel(map, 's2', { fromM: 0, toM: 50 })).toBe('Sin ancho: cárgalo en Portal');
  });
});
