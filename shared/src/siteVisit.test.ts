import { describe, expect, it } from 'vitest';
import { markedPointOf, nextPointNumber, openVisitRowsOf, pointLine, pointProblem, visitDocumentOf, visitIdOfKey, visitNextStep, visitSectionForm, visitUploadOf, visitCardActionOf } from './siteVisit.js';
import { NEW_VISIT, VISIT_WITH_ID } from './siteVisit.fixture.js';

/** The technical visit on the phone (José 13/11, Portal PRIMERA-VISITA §9; designs lv01–lv03). */
const visit = () => visitDocumentOf(VISIT_WITH_ID)!;
const withFigures = (figures: Partial<{ puntos: number; fotos: number; preguntas: number; respondidas: number }>, missing: string[] = []) =>
  visitDocumentOf({ ...VISIT_WITH_ID, cifras: { ...VISIT_WITH_ID.cifras, ...figures }, publish: { label: 'Terminar visita', missing } })!;

describe('visitDocumentOf: Portal\'s visit as the screens read it', () => {
  it('reads the card\'s figures, the stage and the details of a visit in progress', () => {
    // Act
    const document = visit();
    // Assert
    expect(document).toMatchObject({ id: '65f0000000000000000000a1', code: 'VIS-2026-0003', stage: 'draft', stageLabel: 'Borrador', finished: false });
    expect(document.figures).toEqual({ points: 1, photos: 0, questions: 2, answered: 1 });
    expect(document.details).toMatchObject({ prospect: 'Condominio Los Álamos', place: 'Av. Los Incas 120, Surco', engineer: 'Rosa Campos', precisionM: 8 });
  });
  it('reads each point with its number, type, measure and place, in order', () => {
    expect(visit().points).toEqual([{ id: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f', n: 1, type: 'GIBA', typeLabel: 'Giba o rompemuelle', note: 'Giba de 4 m', measure: { value: 4, unit: 'm' }, lat: -12.05, lng: -77.04, at: '2026-11-13T20:00:00.000Z', media: [] }]);
    expect(visit().map.points).toEqual([{ pointId: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f', n: 1, type: 'GIBA', lat: -12.05, lng: -77.04 }]);
  });
  it('a new visit has no id, only the details to start; anything not a visit is null', () => {
    expect(visitDocumentOf(NEW_VISIT.document)).toMatchObject({ id: null, publish: { label: 'Crear visita', missing: ['Escribe a quién visitas'] } });
    expect(visitDocumentOf({ type: 'CTL-IMP' })).toBeNull();
    expect(visitDocumentOf(null)).toBeNull();
  });
  it('drops a photo that is not https and a point without its place', () => {
    const raw = { ...VISIT_WITH_ID, sections: VISIT_WITH_ID.sections.map((section) => (section.id === 'puntos' ? { ...section, items: [{ id: 'p1', n: 1, tipo: 'BACHE', media: [{ url: 'http://x/a.jpg' }] }, { id: 'p2', n: 2, tipo: 'BACHE', lat: -12, lng: -77, media: [{ url: 'http://x/a.jpg' }, { url: 'https://x/b.jpg' }] }] } : section)) };
    expect(visitDocumentOf(raw)!.points.map((point) => [point.id, point.media.length])).toEqual([['p2', 1]]);
  });
});

describe('the open visits and the card\'s key', () => {
  it('lists the open visits Portal sends with a new one', () => {
    expect(openVisitRowsOf(NEW_VISIT.visitas)).toEqual([expect.objectContaining({ id: '65f0000000000000000000a1', code: 'VIS-2026-0003', prospect: 'Condominio Los Álamos' })]);
  });
  it('reads the visit id after «:visita:» in agentes\' key, and nothing from another card', () => {
    expect(visitIdOfKey('portal:test:visita:65f0000000000000000000a1')).toBe('65f0000000000000000000a1');
    expect(visitIdOfKey('portal:test:cotizacion:65f0000000000000000000a1')).toBeNull();
    expect(visitIdOfKey('portal:test:visita:../../x')).toBeNull();
    expect(visitIdOfKey(undefined)).toBeNull();
  });
});

describe('visitNextStep: the one button at the bottom does what comes next (§9.3)', () => {
  it('starts a new visit, marks the first point, goes on with the interview, then finishes', () => {
    expect(visitNextStep(visitDocumentOf(NEW_VISIT.document)!)).toEqual({ kind: 'start', label: 'Crear visita' });
    expect(visitNextStep(withFigures({ puntos: 0, fotos: 0 }))).toEqual({ kind: 'point', label: 'Marcar el primer punto' });
    expect(visitNextStep(withFigures({ preguntas: 10, respondidas: 6 }))).toEqual({ kind: 'interview', label: 'Siguiente: 4 sin responder', unanswered: 4 });
    expect(visitNextStep(withFigures({ respondidas: 2 }))).toEqual({ kind: 'finish', label: 'Terminar visita' });
  });
  it('says what is missing instead of offering to finish, and a finished visit only shows its PDF', () => {
    expect(visitNextStep(withFigures({ respondidas: 2 }, ['El lugar de la visita']))).toEqual({ kind: 'missing', label: 'Falta: El lugar de la visita' });
    expect(visitNextStep(visitDocumentOf({ ...VISIT_WITH_ID, status: 'completed' })!)).toEqual({ kind: 'finished', label: 'Ver PDF' });
  });
});

describe('a point', () => {
  const base = { type: 'BACHE', lat: -12.0217, lng: -76.8817, precisionM: 6 };
  it('«Guardar punto 2» numbers after the last, and its line says the type and the measure', () => {
    expect(nextPointNumber(visit())).toBe(2);
    expect(pointLine(visit().points[0]!)).toBe('Giba · 4 m');
  });
  it('a type and the GPS are enough: no field to type (§9.3, 4 taps and 0 fields)', () => {
    expect(pointProblem(base, visit())).toBeNull();
  });
  it('says the first problem as Portal would: no type, no GPS, a measure without its unit', () => {
    expect(pointProblem({ ...base, type: 'HUECO' }, visit())).toBe('Elige qué es.');
    expect(pointProblem({ ...base, lat: Number.NaN }, visit())).toBe('Falta la ubicación del GPS.');
    expect(pointProblem({ ...base, measure: 12.5 }, visit())).toBe('La medida necesita su unidad.');
    expect(pointProblem({ ...base, unit: 'm2' }, visit())).toBe('La unidad necesita su medida.');
    expect(pointProblem({ ...base, measure: -1, unit: 'm2' }, visit())).toBe('Esa medida no es posible.');
    expect(pointProblem({ ...base, note: 'x'.repeat(201) }, visit())).toBe('La nota lleva hasta 200 letras.');
  });
});

describe('visitSectionForm: Portal\'s schema with what is already saved', () => {
  it('the interview opens with its answers as the starting values', () => {
    const form = visitSectionForm(visit(), 'entrevista')!;
    expect(form).toMatchObject({ id: 'guardar_visita', title: 'Entrevista', submitLabel: 'Guardar' });
    expect(form.schema.properties?.r01).toMatchObject({ default: 'no' });
    expect(form.schema.properties?.r02).not.toHaveProperty('default');
  });
  it('a company without questions has no interview form', () => {
    const noQuestions = visitDocumentOf({ ...VISIT_WITH_ID, forms: { datos: VISIT_WITH_ID.forms.datos, conclusion: VISIT_WITH_ID.forms.conclusion }, sections: VISIT_WITH_ID.sections.filter((section) => section.id !== 'entrevista') })!;
    expect(visitSectionForm(noQuestions, 'entrevista')).toBeNull();
  });
});

describe('the photo ticket a point answers', () => {
  const ticket = { url: 'https://www.constroad.com/api/public/site-visit-upload/eyJ.abc', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2026-11-13T20:30:00.000Z', maxBytes: 52428800, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] };
  it('reads the point, its number and the ticket for its photos', () => {
    expect(markedPointOf({ puntoId: '0b6f1a4e-2c3d-4e5f-8a9b-1c2d3e4f5a6b', n: 4, upload: ticket })).toEqual({ pointId: '0b6f1a4e-2c3d-4e5f-8a9b-1c2d3e4f5a6b', n: 4, upload: ticket });
  });
  it('a ticket to any other address, or without its fields, is no ticket: the photo is never sent elsewhere', () => {
    expect(visitUploadOf({ ...ticket, url: 'https://evil.example.com/api/public/site-visit-upload/x' })).toBeNull();
    expect(visitUploadOf({ ...ticket, url: 'https://www.constroad.com/api/public/service-drive-upload/x' })).toBeNull();
    expect(visitUploadOf({ ...ticket, method: 'PUT' })).toBeNull();
    expect(visitUploadOf({ ...ticket, mimeTypes: ['video/mp4'] })).toBeNull();
    expect(markedPointOf({ n: 4 })).toBeNull();
  });
});

describe('the buttons of the visit card lv01 (agentes 14/11)', () => {
  it('each visita_* id opens its own screen, never the app', () => {
    expect(['visita_marcar_punto', 'visita_entrevista', 'visita_foto', 'visita_terminar', 'visita_pdf', 'visita_croquis'].map(visitCardActionOf)).toEqual(['point', 'interview', 'photo', 'finish', 'pdf', 'croquis']);
  });
  it('any other button stays the app\'s', () => {
    expect(visitCardActionOf('aprobar')).toBeNull();
    expect(visitCardActionOf('visita_otra')).toBeNull();
    expect(visitCardActionOf('toString')).toBeNull();
  });
});
