import { describe, expect, it } from 'vitest';
import { newFieldJob, type FieldJob, type FieldJobFile } from './fieldQueue.js';
import { NEW_VISIT, VISIT_WITH_ID } from './siteVisit.fixture.js';
import { visitDocumentOf, type VisitDocument } from './siteVisit.js';
import { isLocalVisitId, keysGoingWith, localVisitId, LOCAL_VISIT_CODE, localVisitRows, projectVisit, visitJobBlocked, visitJobOf, visitOfflineDraft, visitScopeOf, type VisitJobPayload } from './visitOffline.js';

const NOW = Date.UTC(2026, 10, 24, 15, 30);
const SPACE = '6650f1a2b3c4d5e6f7a8b9c0';
const CHAT = '6651aa00bb11cc22dd33ee44';
const KEY = '4b1f0c2e-9d3a-4e5f-8a7b-6c5d4e3f2a1b';
const LOCAL = localVisitId(KEY);
const REAL = '65f0000000000000000000a1';
const TEMPLATE = visitDocumentOf(NEW_VISIT.document) as VisitDocument;
const SAVED = visitDocumentOf(VISIT_WITH_ID) as VisitDocument;
const PHOTO: FieldJobFile = { key: '0b9c8d7e-6f5a-4b3c-9d2e-1f0a9b8c7d6e', ref: 'file:///data/user/0/com.lilachat.app/files/field-queue/0b9c8d7e.jpg', name: 'visita-1.jpeg', mime: 'image/jpeg' };
const VIDEO: FieldJobFile = { ...PHOTO, key: '1c0d9e8f-7a6b-4c5d-8e3f-2a1b0c9d8e7f', name: 'visita-2.mp4', mime: 'video/mp4' };

let counter = 0;
const keyOf = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const job = (payload: VisitJobPayload, files: FieldJobFile[] = [], key = keyOf()): FieldJob => visitJobOf({ key, spaceId: SPACE, chatId: CHAT, payload, files, now: NOW });

describe('local ids', () => {
  it('a new visit is «local-<its creation key>» until Portal answers its id', () => {
    expect(LOCAL).toBe(`local-${KEY}`);
    expect(isLocalVisitId(LOCAL)).toBe(true);
    expect(isLocalVisitId(REAL)).toBe(false);
  });
});

describe('visitJobOf', () => {
  it('each visit job lives under its visit, so its strip finds it', () => {
    const one = job({ kind: 'visit_finish', visit: REAL });
    expect(one.kind).toBe('visit_finish');
    expect(one.scope).toEqual(visitScopeOf(SPACE, CHAT, REAL));
    expect(one.label).toBe('Terminar la visita');
  });
});

describe('visitOfflineDraft', () => {
  it('a new visit starts from the space\'s template: no id until «Crear visita»', () => {
    const draft = visitOfflineDraft({ visitId: null, saved: null, template: TEMPLATE, jobs: [], resolved: {} });
    expect(draft).toMatchObject({ ok: true, document: { id: null } });
  });

  it('never opened with signal on this phone: it says so, no invented form', () => {
    const draft = visitOfflineDraft({ visitId: null, saved: null, template: null, jobs: [], resolved: {} });
    expect(draft).toEqual({ ok: false, message: 'Sin señal. Abre una visita técnica una vez con señal en este teléfono para poder hacerla sin ella.' });
  });

  it('a local visit is the template with what was queued for it', () => {
    const details = job({ kind: 'visit_section', visit: LOCAL, creates: true, section: 'datos', values: { prospecto: 'Municipalidad de Aucallama', lugar: 'Av. Principal' } }, [], KEY);
    const draft = visitOfflineDraft({ visitId: LOCAL, saved: null, template: TEMPLATE, jobs: [details], resolved: {} });
    expect(draft.ok && draft.document).toMatchObject({ id: LOCAL, code: LOCAL_VISIT_CODE, finished: false });
    expect(draft.ok && draft.document.sections.find((one) => one.id === 'datos')?.values).toMatchObject({ prospecto: 'Municipalidad de Aucallama' });
  });

  it('a resolved local visit reads as its real one', () => {
    const draft = visitOfflineDraft({ visitId: LOCAL, saved: SAVED, template: TEMPLATE, jobs: [], resolved: { [LOCAL]: REAL } });
    expect(draft.ok && draft.document.id).toBe(REAL);
  });

  it('a saved visit opens offline with its pending work on top', () => {
    const point = job({ kind: 'visit_point', visit: REAL, point: { type: 'BACHE', lat: -11.59, lng: -77.21, precisionM: 6 }, takenAt: '2026-11-24T15:30:00.000Z' }, [PHOTO]);
    const draft = visitOfflineDraft({ visitId: REAL, saved: SAVED, template: TEMPLATE, jobs: [point], resolved: {} });
    expect(draft.ok && draft.document.figures.points).toBe(SAVED.figures.points + 1);
  });

  it('a real visit never seen on this phone cannot open offline', () => {
    const draft = visitOfflineDraft({ visitId: REAL, saved: null, template: TEMPLATE, jobs: [], resolved: {} });
    expect(draft.ok).toBe(false);
  });
});

describe('projectVisit', () => {
  it('a queued point is drawn with the next number, its place and the hour it was taken', () => {
    const point = job({ kind: 'visit_point', visit: REAL, point: { type: 'BACHE', lat: -11.59, lng: -77.21, note: 'Bache grande', measure: 4, unit: 'm2' }, takenAt: '2026-11-24T15:30:00.000Z' }, [PHOTO]);
    const document = projectVisit(SAVED, [point], [REAL]);
    const added = document.points.at(-1)!;
    expect(added).toMatchObject({ id: point.key, n: Math.max(0, ...SAVED.points.map((one) => one.n)) + 1, type: 'BACHE', lat: -11.59, lng: -77.21, at: '2026-11-24T15:30:00.000Z', note: 'Bache grande', measure: { value: 4, unit: 'm2' }, pending: true });
    expect(document.figures.photos).toBe(SAVED.figures.photos + 1);
    expect(document.map.points.at(-1)).toMatchObject({ pointId: point.key, type: 'BACHE' });
  });

  it('loose photos and videos add to their own count', () => {
    const photo = job({ kind: 'visit_photo', visit: REAL, place: { lat: -11.59, lng: -77.21, takenAt: '2026-11-24T15:31:00.000Z' } }, [PHOTO]);
    const video = job({ kind: 'visit_photo', visit: REAL, place: { takenAt: '2026-11-24T15:32:00.000Z' } }, [VIDEO]);
    const document = projectVisit(SAVED, [photo, video], [REAL]);
    expect(document.figures.photos).toBe(SAVED.figures.photos + 1);
    expect(document.figures.videos).toBe(SAVED.figures.videos + 1);
  });

  it('interview answers count as answered, never past the questions', () => {
    const questions = SAVED.figures.questions;
    const values = Object.fromEntries(Array.from({ length: questions + 3 }, (_, index) => [`r${String(index + 1).padStart(2, '0')}`, 'si']));
    const answer = job({ kind: 'visit_section', visit: REAL, section: 'entrevista', values });
    expect(projectVisit(SAVED, [answer], [REAL]).figures.answered).toBe(questions);
  });

  it('a section shows what was written in it', () => {
    const conclusion = job({ kind: 'visit_section', visit: REAL, section: 'conclusion', values: { conclusion: 'Requiere parchado en 3 tramos', recomendacion: '' } });
    const section = projectVisit(SAVED, [conclusion], [REAL]).sections.find((one) => one.id === 'conclusion');
    expect(section?.summary).toEqual(['Requiere parchado en 3 tramos']);
    expect(section?.state).not.toBe('empty');
  });

  it('jobs of another visit change nothing', () => {
    const other = job({ kind: 'visit_photo', visit: '65f0000000000000000000ff', place: { takenAt: '2026-11-24T15:31:00.000Z' } }, [PHOTO]);
    expect(projectVisit(SAVED, [other], [REAL])).toEqual(SAVED);
  });
});

describe('visitJobBlocked', () => {
  const details = job({ kind: 'visit_section', visit: LOCAL, creates: true, section: 'datos', values: { prospecto: 'X' } }, [], KEY);
  const point = job({ kind: 'visit_point', visit: LOCAL, point: { type: 'POSTE', lat: -11.59, lng: -77.21 }, takenAt: '2026-11-24T15:30:00.000Z' });
  const finish = job({ kind: 'visit_finish', visit: LOCAL });

  it('the creation goes first; the rest wait for Portal\'s id', () => {
    const queue = [details, point, finish];
    expect(visitJobBlocked(details, queue, {})).toBe(false);
    expect(visitJobBlocked(point, queue, {})).toBe(true);
  });

  it('once created, its work goes; «Terminar» waits until nothing else of the visit is left', () => {
    const resolved = { [LOCAL]: REAL };
    expect(visitJobBlocked(point, [point, finish], resolved)).toBe(false);
    expect(visitJobBlocked(finish, [point, finish], resolved)).toBe(true);
    expect(visitJobBlocked(finish, [finish], resolved)).toBe(false);
  });

  it('a job that is not a visit\'s is never blocked here', () => {
    const drive = newFieldJob({ key: keyOf(), kind: 'drive_file', scope: { spaceId: SPACE, clientId: 'c', serviceId: 's', chatId: CHAT }, label: 'Foto al Drive', payload: {}, files: [PHOTO], now: NOW });
    expect(visitJobBlocked(drive, [details, drive], {})).toBe(false);
  });
});

describe('localVisitRows', () => {
  it('a visit created without signal shows among the open ones until Portal has it', () => {
    const details = job({ kind: 'visit_section', visit: LOCAL, creates: true, section: 'datos', values: { prospecto: 'Municipalidad de Aucallama' } }, [], KEY);
    const point = job({ kind: 'visit_point', visit: LOCAL, point: { type: 'POSTE', lat: -11.59, lng: -77.21 }, takenAt: '2026-11-24T15:30:00.000Z' });
    expect(localVisitRows([details, point], {})).toEqual([{ id: LOCAL, code: LOCAL_VISIT_CODE, prospect: 'Municipalidad de Aucallama', place: 'Sin enviar', visitedAt: new Date(NOW).toISOString(), engineer: '', stage: 'draft', stageLabel: 'Sin enviar', points: 1 }]);
  });

  it('a resolved one is no longer local', () => {
    const details = job({ kind: 'visit_section', visit: LOCAL, creates: true, section: 'datos', values: { prospecto: 'X' } }, [], KEY);
    expect(localVisitRows([details], { [LOCAL]: REAL })).toEqual([]);
  });
});

describe('keysGoingWith', () => {
  it('discarding a new visit\'s creation takes all its work; any other job goes alone', () => {
    const details = job({ kind: 'visit_section', visit: LOCAL, creates: true, section: 'datos', values: {} }, [], KEY);
    const point = job({ kind: 'visit_point', visit: LOCAL, point: { type: 'POSTE', lat: -11.59, lng: -77.21 }, takenAt: '2026-11-24T15:30:00.000Z' });
    const other = job({ kind: 'visit_photo', visit: REAL, place: { takenAt: '2026-11-24T15:31:00.000Z' } }, [PHOTO]);
    expect(keysGoingWith(details, [details, point, other])).toEqual([details.key, point.key]);
    expect(keysGoingWith(point, [details, point, other])).toEqual([point.key]);
  });
});
