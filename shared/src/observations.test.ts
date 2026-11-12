import { describe, expect, it } from 'vitest';
import {
  approximateLine,
  clipLength,
  evidenceBadge,
  evidenceFiles,
  isObservationType,
  gpsLine,
  liftAction,
  registerAction,
  observationCounts,
  observationDocumentOf,
  observationPins,
  observationPlace,
  observationsIn,
  observationWorkMap,
  registeredLine,
  type Observation,
} from './observations.js';

/** Portal's answer as agentes passes it (Portal ead85b1a, agentes 275fb32, 11/11/2026). */
const media = (mime: string, extra: Record<string, unknown> = {}) => ({ url: `https://lila.constroad.com/m/${mime.split('/')[0]}.bin`, mime, ...extra });
const item = (id: string, status: 'open' | 'lifted', extra: Record<string, unknown> = {}) => ({
  id, code: `OBS-00${id}`, note: `Fisura ${id}`, lat: -12.05, lng: -77.03, at: '2026-11-11T15:42:00.000Z', status, media: [media('image/jpeg')], liftMedia: [], ...extra,
});
const body = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  id: 'r1', type: 'REG-OBS', title: 'Registro de observaciones', status: 'draft', forms: {},
  sections: [{ id: 'observaciones', title: 'Observaciones', required: true, state: 'partial', summary: [], results: [], items }],
  map: { streets: [{ id: 's1', name: 'Av. Los Incas', geometry: [{ lat: -12.05, lng: -77.031 }, { lat: -12.05, lng: -77.029 }] }], points: [] },
  publish: { label: 'Publicar', missing: ['Por ahora este informe se publica desde Portal.'] },
  ...extra,
});

describe('observationDocumentOf', () => {
  it('reads the items, the streets and what blocks publishing', () => {
    const document = observationDocumentOf(body([item('1', 'open'), item('2', 'lifted', { liftedAt: '2026-11-11T18:00:00.000Z', liftMedia: [media('video/mp4', { durationS: 18 })] })]));

    expect(document?.type).toBe('REG-OBS');
    expect(document?.observations.map((one) => [one.code, one.status])).toEqual([['OBS-001', 'open'], ['OBS-002', 'lifted']]);
    expect(document?.observations[1]?.liftMedia[0]).toEqual({ url: 'https://lila.constroad.com/m/video.bin', mime: 'video/mp4', durationS: 18 });
    expect(document?.map.streets[0]?.geometry).toHaveLength(2);
    expect(document?.publish.missing).toEqual(['Por ahora este informe se publica desde Portal.']);
  });

  it('keeps an item whose place agentes dropped, and drops one without id, code or status', () => {
    const document = observationDocumentOf(body([item('1', 'open', { lat: null, lng: null }), { code: 'OBS-009', status: 'open' }, item('3', 'closed' as 'open')]));

    expect(document?.observations).toHaveLength(1);
    expect(document?.observations[0]).toEqual(expect.objectContaining({ lat: null, lng: null }));
  });

  it('reads its own output again: the server reads Portal\'s answer and the phone reads what the server sent', () => {
    const once = observationDocumentOf(body([item('1', 'open', { precisionM: 40, aproximada: true }), item('2', 'lifted', { liftedAt: '2026-11-11T18:00:00.000Z', segment: { streetId: 's1', fromM: 10, toM: 20 } })]));

    expect(observationDocumentOf(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it('refuses a document of another type or without publish', () => {
    expect(observationDocumentOf(body([], { type: 'CTL-PIS' }))).toBeNull();
    expect(observationDocumentOf({ ...body([]), publish: undefined })).toBeNull();
    expect(observationDocumentOf(null)).toBeNull();
  });

  it('tolerates a document with no map and no observations section yet', () => {
    const document = observationDocumentOf({ ...body([]), map: undefined, sections: [] });

    expect(document?.observations).toEqual([]);
    expect(document?.map.streets).toEqual([]);
  });
});

describe('the list', () => {
  const observations = observationDocumentOf(body([item('1', 'open'), item('2', 'lifted'), item('3', 'open')]))!.observations;

  it('splits pending from lifted and counts the progress', () => {
    expect(observationsIn(observations, 'open').map((one) => one.id)).toEqual(['1', '3']);
    expect(observationsIn(observations, 'lifted').map((one) => one.id)).toEqual(['2']);
    expect(observationCounts(observations)).toEqual({ total: 3, open: 2, lifted: 1, percent: 33 });
    expect(observationCounts([])).toEqual({ total: 0, open: 0, lifted: 0, percent: 0 });
  });

  it('pins each placed observation with its number, red while pending and green once lifted', () => {
    const pins = observationPins([...observations, { ...observations[0]!, id: '4', code: 'OBS-004', lat: null, lng: null }]);

    expect(pins.map((pin) => [pin.id, pin.label])).toEqual([['1', '1'], ['2', '2'], ['3', '3']]);
    expect(pins[0]?.fill).not.toBe(pins[1]?.fill);
  });

  it('frames the observations when the service has no street yet', () => {
    expect(observationWorkMap({ streets: [] }, observations).bounds).toEqual([[-77.03, -12.05], [-77.03, -12.05]]);
    expect(observationWorkMap({ streets: [] }, []).bounds).toBeNull();
  });
});

describe('what a card says', () => {
  const map = observationDocumentOf(body([]))!.map;
  const base = observationDocumentOf(body([item('1', 'open')]))!.observations[0]!;

  it('names the street and the station when the observation lies on one', () => {
    expect(observationPlace({ ...base, lat: -12.05, lng: -77.03 }, map)).toMatch(/^Av\. Los Incas 0\+1\d\d$/);
    expect(observationPlace({ ...base, segment: { streetId: 's1', fromM: 240, toM: 250 } }, map)).toBe('Av. Los Incas 0+240');
    expect(observationPlace({ ...base, lat: -11.9, lng: -76.9 }, map)).toBe('Ubicación GPS');
    expect(observationPlace({ ...base, lat: null, lng: null }, map)).toBe('Sin ubicación');
  });

  it('says the evidence: a video with its length, or how many photos', () => {
    const video: Observation = { ...base, media: [{ url: 'https://lila.constroad.com/v', mime: 'video/mp4', durationS: 18 }] };
    expect(evidenceBadge(video.media)).toBe('VIDEO 0:18');
    expect(evidenceBadge(base.media)).toBe('FOTO');
    expect(evidenceBadge([...base.media, ...base.media])).toBe('2 FOTOS');
    expect(evidenceBadge([])).toBe('SIN EVIDENCIA');
    expect(clipLength(75)).toBe('1:15');
  });

  it('says when it was registered, in Lima time', () => {
    expect(registeredLine(base)).toBe('Registrada 11/11 · 10:42');
    expect(registeredLine({ ...base, at: null })).toBe('Registrada');
  });

  it('the bottom button does the next pending step, never turned off', () => {
    expect(liftAction(0)).toEqual({ kind: 'take-after', label: 'Tomar foto del después' });
    expect(liftAction(1).kind).toBe('lift');
    expect(registerAction('reading').kind).toBe('gps-wait');
    expect(registerAction('missing').label).toBe('Leer el GPS de nuevo');
    expect(registerAction('ready').label).toBe('Registrar observación');
  });

  it('shows the GPS precision, not the coordinates', () => {
    expect(gpsLine(4.4)).toBe('GPS ±4 m');
    expect(gpsLine()).toBe('GPS activo');
  });

  it('knows the two observation types', () => {
    expect(isObservationType('REG-OBS')).toBe(true);
    expect(isObservationType('LEV-OBS')).toBe(true);
    expect(isObservationType('CTL-PIS')).toBe(false);
  });
});

describe('evidenceFiles', () => {
  it('names each file after its observation, for the viewer', () => {
    expect(evidenceFiles([{ url: 'https://lila.constroad.com/a', mime: 'image/jpeg', thumbUrl: 'https://lila.constroad.com/t' }], 'OBS-003 · antes')).toEqual([{ name: 'OBS-003 · antes 1', mime: 'image/jpeg', url: 'https://lila.constroad.com/a', thumbUrl: 'https://lila.constroad.com/t' }]);
  });
});

describe('an approximate place (Portal marks it past 15 m)', () => {
  it('reads the precision and the mark, and says it', () => {
    const [far, near] = observationDocumentOf(body([item('1', 'open', { precisionM: 40, aproximada: true }), item('2', 'open', { precisionM: 4 })]))!.observations;
    expect(approximateLine(far!)).toBe('Ubicación aproximada (±40 m)');
    expect(approximateLine(near!)).toBeNull();
  });
});

