import { describe, expect, it } from 'vitest';
import { afterQuietReload, lineLengthM, workMapOf, type WorkMap } from './workMap.js';
import { streetDetailOf } from './workStreetDetail.js';
import { createdOrRefusal, editThenReload, labelFormIdle, runLabelCreate, runScopeSave, sendWorkStage, type LabelForm, SCOPE_PAST_STREET, SCOPE_ENDS_BEFORE, SCOPE_NEEDS_ENDS, LABEL_NEEDS_NAME, LABEL_TOO_LONG, labelProblem, scopeDraftFor, scopeDraftProblem, toggleScopeWork, WORK_TAG_COLORS, workScopeDeleteRequest, workScopeRequest, workStageRequest, workTagRequest } from './workScopeDraft.js';

/** Step 3 of the map (José 07/11: «itera hasta terminarlo»): a street and its stretches (o-03), stages (o-04) and works (o-05). */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const LENGTH = Math.round(lineLengthM(line));
const ENTRY = '0b7e7d0e-6a8f-4c3b-9d2e-1f2a3b4c5d6e';

const mapOf = (): WorkMap => {
  const map = workMapOf({
    partidas: [{ _id: 'p1', description: 'Bacheo' }],
    workStreets: {
      streets: [{ _id: 's1', name: 'Jr. Los Pinos', geometry: line, lengthM: 320, widthM: 6 }],
      scopes: [
        { _id: 'c1', streetId: 's1', fromM: 0, toM: 160, tagIds: ['base', 'asfalto'], partidaIds: [], stageId: 'e1', widthM: 6 },
        { _id: 'c2', streetId: 's1', fromM: 160, toM: 320, tagIds: [], partidaIds: ['p1'] },
      ],
      progress: [
        { streetId: 's1', tagId: 'base', fromM: 0, toM: 160, date: '2026-11-01' },
        { streetId: 's1', tagId: 'asfalto', fromM: 0, toM: 40, date: '2026-11-02' },
      ],
      tags: [{ _id: 'base', name: 'Base', color: '#c08a1e', order: 1 }, { _id: 'asfalto', name: 'Asfalto', color: '#111111', order: 2 }],
      stages: [{ _id: 'e1', name: 'Etapa 1', order: 1 }],
    },
  });
  if (!map) throw new Error('expected a map');
  return map;
};

describe('the map keeps what a stretch needs to be edited', () => {
  it('each stretch keeps its id and width, each street its width', () => {
    const map = mapOf();
    expect(map.scopes[0]).toMatchObject({ id: 'c1', widthM: 6, stageId: 'e1' });
    expect(map.scopes[1]).toMatchObject({ id: 'c2' });
    expect(map.scopes[1]).not.toHaveProperty('widthM');
    expect(map.streets[0]).toMatchObject({ widthM: 6 });
  });
});

describe('a street and its stretches (design o-03)', () => {
  it('heads with length and width, a bar per work and the stretches in order', () => {
    // Act
    const detail = streetDetailOf(mapOf(), 's1');
    // Assert
    expect(detail).toMatchObject({ id: 's1', name: 'Jr. Los Pinos', headline: '320 m · 6,0 m' });
    expect(detail?.layers).toEqual([
      { workId: 'base', name: 'Base', color: '#c08a1e', doneM: 160, totalM: 160, percent: 100 },
      { workId: 'asfalto', name: 'Asfalto', color: '#111111', doneM: 40, totalM: 160, percent: 25 },
      { workId: 'p1', name: 'Bacheo', color: expect.any(String), doneM: 0, totalM: 160, percent: 0 },
    ]);
    expect(detail?.scopes.map((scope) => [scope.id, scope.title, scope.range, scope.summary, scope.stageName])).toEqual([
      ['c1', 'Tramo 1', '0+000 a 0+160', '160 m · 6,0 m · 960 m²', 'Etapa 1'],
      ['c2', 'Tramo 2', '0+160 a 0+320', '160 m · 6,0 m · 960 m²', null],
    ]);
    expect(detail?.scopes[0]?.works.map((work) => [work.name, work.percent])).toEqual([['Base', 100], ['Asfalto', 25]]);
  });

  it('a street without width or stretches says so, and an unknown street is null', () => {
    const map = mapOf();
    const bare: WorkMap = { ...map, streets: [{ ...map.streets[0]!, widthM: undefined }], scopes: [] };
    expect(streetDetailOf(bare, 's1')).toMatchObject({ headline: '320 m', layers: [], scopes: [] });
    expect(streetDetailOf(map, 'nope')).toBeNull();
  });
});

describe('adding or editing a stretch', () => {
  it('a new one starts as the whole street, without works nor stage', () => {
    expect(scopeDraftFor(320)).toEqual({ fromM: 0, toM: 320, workIds: [], stageId: null, widthM: null });
  });

  it('asks for both ends, the end after the start, and no further than the street (Portal\'s 0,5 m)', () => {
    expect(scopeDraftProblem({ ...scopeDraftFor(320), toM: null }, 320)).toBe(SCOPE_NEEDS_ENDS);
    expect(scopeDraftProblem({ ...scopeDraftFor(320), fromM: 200, toM: 100 }, 320)).toBe(SCOPE_ENDS_BEFORE);
    expect(scopeDraftProblem({ ...scopeDraftFor(320), toM: 321 }, 320)).toBe(SCOPE_PAST_STREET(320));
    expect(scopeDraftProblem({ ...scopeDraftFor(320), toM: 320.4 }, 320)).toBeNull();
  });

  it('a tap on a work adds it and a second one takes it out', () => {
    const once = toggleScopeWork(scopeDraftFor(320), 'base');
    expect(once.workIds).toEqual(['base']);
    expect(toggleScopeWork(once, 'base').workIds).toEqual([]);
  });

  it('the request splits the works into Portal\'s tags and partidas, and keeps the entry only for a new one', () => {
    // Arrange
    const draft = { fromM: 0, toM: 160, workIds: ['base', 'p1'], stageId: 'e1', widthM: 6 };
    // Act
    const created = workScopeRequest(mapOf(), 's1', draft, ENTRY);
    const edited = workScopeRequest(mapOf(), 's1', { ...draft, stageId: null, widthM: null }, ENTRY, 'c1');
    // Assert
    expect(created).toEqual({ kind: 'work_scope', street_id: 's1', from_m: 0, to_m: 160, tag_ids: ['base'], partida_ids: ['p1'], stage_id: 'e1', width_m: 6, entry_id: ENTRY, forms: expect.any(Number) });
    expect(edited).toEqual({ kind: 'work_scope', street_id: 's1', scope_id: 'c1', from_m: 0, to_m: 160, tag_ids: ['base'], partida_ids: ['p1'], stage_id: null, forms: expect.any(Number) });
  });

  it('deleting a stretch sends only its id', () => {
    expect(workScopeDeleteRequest('c2')).toEqual({ kind: 'work_scope_delete', scope_id: 'c2', forms: expect.any(Number) });
  });
});

describe('a new stage or work', () => {
  it('needs a name of up to 60 letters', () => {
    expect(labelProblem('  ')).toBe(LABEL_NEEDS_NAME);
    expect(labelProblem('x'.repeat(61))).toBe(LABEL_TOO_LONG);
    expect(labelProblem('Etapa 2')).toBeNull();
  });

  it('a stage is its trimmed name; a work, its name and one of the colors of the drawings', () => {
    expect(workStageRequest('  Etapa 2 ')).toEqual({ kind: 'work_stage', name: 'Etapa 2', forms: expect.any(Number) });
    expect(workTagRequest('Bacheo', WORK_TAG_COLORS[2]!)).toEqual({ kind: 'work_tag', name: 'Bacheo', color: WORK_TAG_COLORS[2], forms: expect.any(Number) });
    expect(WORK_TAG_COLORS.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
    expect(LENGTH).toBeGreaterThan(0);
  });
});

describe('an edit of the map, then the map again', () => {
  it('reloads only when Portal kept it, and passes the answer through', async () => {
    // Arrange
    let reloads = 0;
    const reload = async () => { reloads += 1; };
    const ok = editThenReload(async () => ({ ok: true, message: 'Tramo guardado.' }), reload)!;
    const refused = editThenReload(async () => ({ ok: false, message: 'tiene_avance' }), reload)!;
    // Act
    const kept = await ok(workStageRequest('Etapa 2'), sendWorkStage);
    const failed = await refused(workStageRequest('Etapa 2'), sendWorkStage);
    // Assert
    expect(kept).toEqual({ ok: true, message: 'Tramo guardado.' });
    expect(failed.ok).toBe(false);
    expect(reloads).toBe(1);
    expect(editThenReload(undefined, reload)).toBeUndefined();
  });
});

describe('the inline forms (shared by the web and the APK)', () => {
  it('a new label checks the name, creates, then closes; a refusal stays on the form', async () => {
    const seen: LabelForm[] = [];
    await runLabelCreate({ ...labelFormIdle('#0d9488'), open: true, name: '' }, async () => null, (form) => seen.push(form));
    expect(seen.at(-1)?.error).toBe(LABEL_NEEDS_NAME);
    await runLabelCreate({ ...labelFormIdle('#0d9488'), open: true, name: 'Bacheo' }, async () => null, (form) => seen.push(form));
    expect(seen.at(-1)).toEqual(labelFormIdle('#0d9488'));
    await runLabelCreate({ ...labelFormIdle(), open: true, name: 'Bacheo' }, async () => 'Ya existe', (form) => seen.push(form));
    expect(seen.at(-1)).toMatchObject({ open: true, busy: false, error: 'Ya existe' });
  });

  it('saving a stretch says the problem first, then Portal\'s answer', async () => {
    const send = async () => ({ ok: false as const, message: 'tiene_avance' });
    const base = { map: mapOf(), streetId: 's1', lengthM: 320, entryId: ENTRY, send };
    expect(await runScopeSave({ ...base, draft: { ...scopeDraftFor(320), toM: null } })).toBe(SCOPE_NEEDS_ENDS);
    expect(await runScopeSave({ ...base, draft: scopeDraftFor(320) })).toBe('tiene_avance');
    expect(await runScopeSave({ ...base, draft: scopeDraftFor(320), send: async () => ({ ok: true, message: 'ok' }) })).toBeNull();
    expect(await createdOrRefusal(Promise.resolve({ ok: false, message: 'no' }))).toBe('no');
    expect(await createdOrRefusal(Promise.resolve({ ok: true, message: 'ok' }))).toBeNull();
  });
});

describe('reloading the map after an edit', () => {
  it('keeps the map on screen if the quiet reload fails, and takes the new one otherwise', () => {
    const ready = { kind: 'ready' as const, url: 'https://x', map: mapOf() };
    const failed = { kind: 'failed' as const, message: 'sin señal' };
    expect(afterQuietReload(ready, failed)).toBe(ready);
    const newer = { ...ready, map: null };
    expect(afterQuietReload(ready, newer)).toBe(newer);
    expect(afterQuietReload({ kind: 'loading' }, failed)).toBe(failed);
  });
});
