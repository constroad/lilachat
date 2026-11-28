import { describe, expect, it } from 'vitest';
import { WORK_MAP_MIN_FRAME_DEG, workMapOf, type WorkMap } from './workMap.js';
import { GPS_OFF_STREET, GPS_WEAK, progressPreviewOf } from './workManualProgress.js';
import { gpsStreetOf, locateRecordStreet, recordStageOf, recordStreetChoices, recordDropAt, recordHandleOf, recordHint, recordMapOf, recordProblem, recordStreetOf, recordSummary, recordTitle, recordWholeStreet, youAreOn, chainageAtPercent, recordAtPercent, streetPercentOf } from './workProgressRecord.js';

/** Design ma04 (José 28/11): the street by GPS, a ring dragged along its axis, a photo and send. */
const progreso = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const lima = [{ lat: -12.01, lng: -77 }, { lat: -12.01, lng: -76.997 }];

const mapOf = (pending: WorkMap['pending'] = []): WorkMap => {
  const map = workMapOf({
    workStreets: {
      streets: [
        { _id: 's1', name: 'Jr. Progreso', geometry: progreso, lengthM: 284, widthM: 6 },
        { _id: 's2', name: 'Jr. Lima', geometry: lima, lengthM: 300 },
        { _id: 's3', name: 'Sin trabajo', geometry: lima, lengthM: 300 },
      ],
      scopes: [
        { _id: 'c1', streetId: 's1', fromM: 0, toM: 250, tagIds: ['imp'], partidaIds: [] },
        { _id: 'c2', streetId: 's2', fromM: 0, toM: 300, tagIds: ['imp'], partidaIds: [] },
      ],
      progress: [{ streetId: 's1', tagId: 'imp', fromM: 0, toM: 100, date: '2026-11-27' }],
      tags: [{ _id: 'imp', name: 'Imprimación', color: '#d97706', order: 1 }],
      stages: [],
    },
  });
  if (!map) throw new Error('expected a map');
  return { ...map, pending };
};

const along = (line: typeof progreso, share: number) => ({ lat: line[0]!.lat, lng: line[0]!.lng + (line[1]!.lng - line[0]!.lng) * share });
const draft = { workId: 'imp', fromM: 120, toM: 166, photoIds: [], note: '' };

describe('ma04: which street, by GPS', () => {
  it('picks the worked street under the phone and says how sure it is', () => {
    // Arrange
    const fix = { ...along(progreso, 0.5), accuracyM: 4.3 };
    // Act
    const located = gpsStreetOf(mapOf(), fix);
    // Assert
    expect(located).toMatchObject({ streetId: 's1', name: 'Jr. Progreso', accuracyM: 4.3 });
    expect(youAreOn(located!)).toBe('Estás en Jr. Progreso · ±4 m');
  });

  it('a weak signal, no position or a phone far from every street leave the choice to the person', () => {
    expect(gpsStreetOf(mapOf(), null)).toEqual({ problem: null });
    expect(gpsStreetOf(mapOf(), { ...along(progreso, 0.5), accuracyM: 60 })).toEqual({ problem: GPS_WEAK(60) });
    expect(gpsStreetOf(mapOf(), { lat: -12.05, lng: -77, accuracyM: 5 })).toEqual({ problem: GPS_OFF_STREET(4448) });
  });

  it('a street without work is never picked, even when the phone stands on it', () => {
    const map = { ...mapOf(), scopes: mapOf().scopes.filter((scope) => scope.streetId === 's1') };
    expect(gpsStreetOf(map, { ...along(lima, 0.5), accuracyM: 4 })).toMatchObject({ problem: expect.stringContaining('Estás a') });
  });

  it('the street given by whoever opened it wins; else the GPS one; else none (the chooser)', () => {
    const located = { streetId: 's2', name: 'Jr. Lima', accuracyM: 4, distanceM: 2 };
    expect(recordStreetOf('s1', located)).toBe('s1');
    expect(recordStreetOf(null, located)).toBe('s2');
    expect(recordStreetOf(null, { problem: null })).toBeNull();
  });
});

describe('ma04: the ring', () => {
  it('sits on the axis at the end, with its chainage, and a new key after each drop', () => {
    const street = mapOf().streets[0]!;
    const handle = recordHandleOf(street, 142, 3);
    expect(handle).toMatchObject({ handle: 'end', label: '0+142' });
    expect(handle!.point.lat).toBeCloseTo(-12, 6);
    expect(handle!.key).not.toBe(recordHandleOf(street, 142, 4)!.key);
    expect(recordHandleOf({ ...street, line: [] }, 142, 0)).toBeNull();
  });

  it('dropped off the axis it snaps onto it; never before the start nor past the street', () => {
    const street = mapOf().streets[0]!;
    const near = { ...along(progreso, 0.5), lat: -12.0001 };
    expect(recordDropAt(draft, street.line, 284, near).toM).toBeGreaterThan(150);
    expect(recordDropAt(draft, street.line, 284, along(progreso, 0.1)).toM).toBe(120);
    expect(recordDropAt(draft, street.line, 284, along(progreso, 1)).toM).toBe(284);
    expect(recordDropAt(draft, [], 284, near)).toBe(draft);
  });

  it('«Toda la calle» goes to the end of the work\'s stretch, or of the street without one', () => {
    expect(recordWholeStreet(mapOf(), 's1', draft, 284).toM).toBe(250);
    expect(recordWholeStreet(mapOf(), 's3', draft, 300).toM).toBe(300);
    expect(recordWholeStreet(mapOf(), 's1', { ...draft, fromM: 260 }, 284).toM).toBe(260);
  });
});

describe('ma04: what it reads', () => {
  it('the big summary: metres, the stretch, the area with the width and the street total', () => {
    expect(recordSummary(draft, 284, 6)).toEqual({ gain: '+46 m', stretch: '0+120 → 0+166', area: '276 m²', areaHow: '46 m × 6 m', total: 'Total calle: 284 m', donePct: 42, newPct: 16 });
    expect(recordSummary(draft, 284)).toMatchObject({ area: null, areaHow: null });
    expect(recordSummary({ ...draft, toM: 100 }, 0)).toMatchObject({ gain: '+0 m', donePct: 0, newPct: 0 });
  });

  it('the title and the hint name the work', () => {
    expect(recordTitle('Imprimación')).toBe('Registrar avance de Imprimación');
    expect(recordTitle(null)).toBe('Registrar avance');
    expect(recordHint('Imprimación')).toBe('Arrastra el círculo hasta donde llegó Imprimación');
  });

  it('what blocks it before the camera opens: what waits, no length, past the street', () => {
    expect(recordProblem(mapOf(), 's1', 284, draft)).toBeNull();
    expect(recordProblem(mapOf([{ streetId: 's1', workId: 'imp', fromM: 100, toM: 180 }]), 's1', 284, draft)).toContain('Ya hay un avance por aprobar hasta 0+180');
    expect(recordProblem(mapOf(), 's1', 284, { ...draft, toM: 120 })).toBe('Indica hasta dónde avanzó.');
    expect(recordProblem(mapOf(), 's1', 284, { ...draft, workId: null })).toBe('Elige qué trabajo avanzó.');
  });

  it('the map of the screen: the street alone, the new stretch in its color and what waits', () => {
    const shown = recordMapOf(mapOf([{ streetId: 's1', workId: 'imp', fromM: 100, toM: 120 }, { streetId: 's2', workId: 'imp', fromM: 0, toM: 10 }]), 's1', draft, 0);
    expect(shown.view.streets.map((street) => street.id)).toEqual(['s1']);
    expect(shown.stretch).toMatchObject([{ fromM: 120, toM: 166, color: '#d97706' }]);
    expect(shown.pending).toMatchObject([{ fromM: 100, toM: 120 }]);
    expect(shown.handles).toMatchObject([{ label: '0+166' }]);
    expect(recordMapOf(mapOf(), 'gone', draft, 0).handles).toEqual([]);
  });

  it('a 7 m street the layer is not on yet (José 28/11, «Jirón Lima parche 02»): framed wide enough, with its ring', () => {
    // Arrange
    const patch = [{ lat: -12.02, lng: -77 }, { lat: -12.02, lng: -76.99994 }];
    const base = mapOf();
    const map: WorkMap = { ...base, streets: [...base.streets, { ...base.streets[0]!, id: 's4', name: 'Jirón Lima parche 02', line: patch, lengthM: 7 }] };
    // Act
    const frame = progressPreviewOf(map, 's4', { workId: null, fromM: 0, toM: 0 }).view.bounds;
    const shown = recordMapOf(map, 's4', { ...draft, fromM: 0, toM: 0 }, 0);
    // Assert
    expect(frame).not.toBeNull();
    expect(frame![1][0] - frame![0][0]).toBeCloseTo(WORK_MAP_MIN_FRAME_DEG, 9);
    expect(frame![1][1] - frame![0][1]).toBeCloseTo(WORK_MAP_MIN_FRAME_DEG, 9);
    expect(shown.handles).toMatchObject([{ handle: 'end', label: '0+000', point: patch[0] }]);
  });
});

describe('ma04: the screen', () => {
  const located = { streetId: 's1', name: 'Jr. Progreso', accuracyM: 4, distanceM: 1 };

  it('the answer, the street with its ring, or the chooser', () => {
    expect(recordStageOf({ picked: null, located: null, choosing: false, sent: 'Listo' })).toEqual({ kind: 'sent', message: 'Listo' });
    expect(recordStageOf({ picked: null, located, choosing: false, sent: null })).toEqual({ kind: 'record', streetId: 's1', located });
    expect(recordStageOf({ picked: 's2', located, choosing: false, sent: null })).toEqual({ kind: 'record', streetId: 's2', located: null });
    expect(recordStageOf({ picked: null, located: null, choosing: false, sent: null })).toEqual({ kind: 'choose', problem: null, locating: true });
    expect(recordStageOf({ picked: null, located: { problem: 'GPS débil' }, choosing: false, sent: null })).toEqual({ kind: 'choose', problem: 'GPS débil', locating: false });
    expect(recordStageOf({ picked: 's1', located, choosing: true, sent: null })).toMatchObject({ kind: 'choose', locating: false });
  });

  it('the chooser lists the streets with work only', () => {
    expect(recordStreetChoices(mapOf())).toEqual([{ id: 's1', name: 'Jr. Progreso' }, { id: 's2', name: 'Jr. Lima' }]);
    const one = { ...mapOf(), scopes: mapOf().scopes.filter((scope) => scope.streetId === 's2') };
    expect(recordStreetChoices(one)).toEqual([{ id: 's2', name: 'Jr. Lima' }]);
    expect(recordStreetChoices({ ...mapOf(), scopes: [] })).toEqual([]);
  });

  it('one GPS read; an answer after closing is dropped', async () => {
    const seen: unknown[] = [];
    const fix = { ...along(progreso, 0.5), accuracyM: 4 };
    locateRecordStreet(async () => fix, mapOf, (one) => seen.push(one));
    const cancel = locateRecordStreet(async () => fix, mapOf, (one) => seen.push(one));
    cancel();
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ streetId: 's1' });
  });
});

describe('the % of the street (José 28/11: slider or typed %)', () => {
  const DRAFT = { workId: 'w', fromM: 0, toM: 0, photoIds: [], note: '' };

  it('turns a % into a chainage clamped to the street, to the centimeter', () => {
    expect(chainageAtPercent(50, 44.28)).toBe(22.14);
    expect(chainageAtPercent(100, 44.28)).toBe(44.28);
    expect(chainageAtPercent(140, 44.28)).toBe(44.28);
    expect(chainageAtPercent(-5, 44.28)).toBe(0);
    expect(chainageAtPercent(Number.NaN, 44.28)).toBe(0);
    expect(chainageAtPercent(50, 0)).toBe(0);
  });

  it('reads the ring back as % with one decimal', () => {
    expect(streetPercentOf(22.14, 44.28)).toBe(50);
    expect(streetPercentOf(10, 44.28)).toBe(22.6);
    expect(streetPercentOf(60, 44.28)).toBe(100);
    expect(streetPercentOf(10, 0)).toBe(0);
  });

  it('moves the ring to the typed %, never before where the work stopped', () => {
    // Arrange
    const started = { ...DRAFT, fromM: 30 };
    // Act / Assert
    expect(recordAtPercent(DRAFT, 44.28, 50).toM).toBe(22.14);
    expect(recordAtPercent(started, 44.28, 10).toM).toBe(30);
    expect(recordSummary(recordAtPercent(DRAFT, 44.28, 50), 44.28, 6).stretch).toBe('0+000 → 0+022');
  });

  it('round-trips: the % typed is the % shown', () => {
    const typed = 37.5;
    expect(streetPercentOf(chainageAtPercent(typed, 44.28), 44.28)).toBe(typed);
  });
});
