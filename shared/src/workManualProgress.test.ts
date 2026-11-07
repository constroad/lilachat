import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms.js';
import type { FormSubmitReply } from './appActions.js';
import type { CommandOutcome } from './botCommands.js';
import type { WorkProgressDeps } from './workProgressSend.js';
import { workMapOf, type WorkMap } from './workMap.js';
import type { MapEditSend } from './workScopeDraft.js';
import { addManualPhoto, manualPhotoOf, MANUAL_PHOTO_UNLINKED, runManualProgress, MANUAL_FAILED, MANUAL_NO_LENGTH, MANUAL_PAST_STREET, MANUAL_PHOTOS_MAX, MANUAL_PICK_WORK, MANUAL_SENT, manualDraftFor, manualFigures, manualProblem, manualStartOf, nudgeManualEnd, pickManualWork, sendWorkManualProgress, workManualProgressRequest } from './workManualProgress.js';

/** Design o-06 (Portal 57f06ec7): progress marked by hand, without trucks. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const ENTRY = '0b7e7d0e-6a8f-4c3b-9d2e-1f2a3b4c5d6e';
const MEDIA = '6aef8d455e4b25190f7c3177';
const form = { commandId: 'cmd-1', appId: 'app-1', appName: 'Portal', outcome: 'form', response: { responseType: 'form' } } as CommandOutcome;
const answered = (text: string): FormSubmitReply => ({ ok: true, outcome: { commandId: 'cmd-1', appId: 'app-1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text } } as CommandOutcome });

const mapOf = (scopes = [
  { _id: 'c1', streetId: 's1', fromM: 0, toM: 160, tagIds: ['base', 'asfalto'], partidaIds: [] },
  { _id: 'c2', streetId: 's1', fromM: 160, toM: 320, tagIds: [], partidaIds: ['p1'] },
]): WorkMap => {
  const map = workMapOf({
    partidas: [{ _id: 'p1', description: 'Bacheo' }],
    workStreets: {
      streets: [{ _id: 's1', name: 'Jr. Los Pinos', geometry: line, lengthM: 320, widthM: 6 }],
      scopes,
      progress: [
        { streetId: 's1', tagId: 'base', fromM: 0, toM: 120, date: '2026-11-01' },
        { streetId: 's1', tagId: 'base', fromM: 120, toM: 140, date: '2026-11-02', rework: true },
      ],
      tags: [{ _id: 'base', name: 'Base', color: '#c08a1e', order: 1 }, { _id: 'asfalto', name: 'Asfalto', color: '#111111', order: 2 }],
      stages: [],
    },
  });
  if (!map) throw new Error('expected a map');
  return map;
};

describe('manual progress: where it starts', () => {
  it('follows where the approved progress stopped; a rework does not move it', () => {
    expect(manualStartOf(mapOf(), 's1', 'base')).toBe(120);
  });

  it('without progress, starts where the work\'s stretch starts', () => {
    expect(manualStartOf(mapOf(), 's1', 'asfalto')).toBe(0);
    expect(manualStartOf(mapOf(), 's1', 'p1')).toBe(160);
    expect(manualStartOf(mapOf(), 's1', 'nada')).toBe(0);
  });

  it('with one work on the street it comes picked; with several, none', () => {
    // Arrange
    const single = mapOf([{ _id: 'c1', streetId: 's1', fromM: 0, toM: 320, tagIds: ['base'], partidaIds: [] }]);
    // Act
    const one = manualDraftFor(single, 's1');
    const many = manualDraftFor(mapOf(), 's1');
    // Assert
    expect(one.draft).toEqual({ workId: 'base', fromM: 120, toM: 120, photoIds: [], note: '' });
    expect(many.works.map((work) => work.id)).toEqual(['base', 'asfalto', 'p1']);
    expect(many.draft.workId).toBeNull();
  });

  it('picking a work moves the start and keeps the length', () => {
    const map = mapOf();
    const draft = { workId: 'asfalto', fromM: 0, toM: 30, photoIds: [], note: '' };
    expect(pickManualWork(map, 's1', draft, 'base')).toMatchObject({ workId: 'base', fromM: 120, toM: 150 });
  });
});

describe('manual progress: the end', () => {
  const draft = { workId: 'base', fromM: 120, toM: 120, photoIds: [], note: '' };

  it('±10 m never goes before the start nor past the street', () => {
    expect(nudgeManualEnd(draft, 10, 320).toM).toBe(130);
    expect(nudgeManualEnd(draft, -10, 320).toM).toBe(120);
    expect(nudgeManualEnd({ ...draft, toM: 315 }, 10, 320).toM).toBe(320);
  });

  it('says what is missing before sending', () => {
    expect(manualProblem({ ...draft, workId: null, toM: 200 }, 320)).toBe(MANUAL_PICK_WORK);
    expect(manualProblem(draft, 320)).toBe(MANUAL_NO_LENGTH);
    expect(manualProblem({ ...draft, toM: 330 }, 320)).toBe(MANUAL_PAST_STREET(320));
    expect(manualProblem({ ...draft, toM: 240 }, 320)).toBeNull();
  });

  it('shows the length and, with the width, the area', () => {
    expect(manualFigures({ ...draft, toM: 240 }, 6)).toBe('+120 m · 720 m²');
    expect(manualFigures({ ...draft, toM: 240 })).toBe('+120 m');
  });

  it('keeps up to six photos, without repeats', () => {
    let next = addManualPhoto(draft, MEDIA);
    next = addManualPhoto(next, MEDIA);
    expect(next.photoIds).toEqual([MEDIA]);
    for (let index = 0; index < 10; index += 1) next = addManualPhoto(next, `m${index}`);
    expect(next.photoIds).toHaveLength(MANUAL_PHOTOS_MAX);
  });
});

describe('manual progress: what is sent', () => {
  it('a tag goes as tag_id, with the phone\'s hour and the photos', () => {
    // Act
    const request = workManualProgressRequest(mapOf(), 's1', { workId: 'base', fromM: 120, toM: 240.4, photoIds: [MEDIA], note: '' }, ENTRY, new Date('2026-11-07T15:00:00.000Z'));
    // Assert
    expect(request).toEqual({ kind: 'work_manual_progress', street_id: 's1', tag_id: 'base', from_m: 120, to_m: 240, entry_id: ENTRY, device_at: '2026-11-07T15:00:00.000Z', photo_ids: [MEDIA], forms: FORMS_LEVEL });
  });

  it('a contracted item goes as partida_id', () => {
    const request = workManualProgressRequest(mapOf(), 's1', { workId: 'p1', fromM: 160, toM: 200, photoIds: [], note: '' }, ENTRY, new Date());
    expect(request).toMatchObject({ partida_id: 'p1' });
    expect(request).not.toHaveProperty('tag_id');
  });

  it('sends the note trimmed, and says it is pending; a refusal comes back as Portal said it', async () => {
    // Arrange
    const deps: WorkProgressDeps = { open: vi.fn(async () => ({ ok: true as const, data: form })), submit: vi.fn(async () => answered('')), notice: vi.fn(async () => null) };
    // Act
    const sent = await sendWorkManualProgress(deps, '  base compactada  ');
    const failed = await sendWorkManualProgress({ ...deps, open: async () => ({ ok: false as const }) }, '');
    // Assert
    expect(deps.submit).toHaveBeenCalledWith('cmd-1', { nota: 'base compactada' });
    expect(sent).toEqual({ ok: true, message: MANUAL_SENT });
    expect(failed).toEqual({ ok: false, message: MANUAL_FAILED });
  });
});

describe('manual progress: photos and the run', () => {
  it('a photo needs Portal\'s file id', () => {
    expect(manualPhotoOf({ ok: true, mediaId: MEDIA })).toEqual({ ok: true, mediaId: MEDIA });
    expect(manualPhotoOf({ ok: true })).toEqual({ ok: false, message: MANUAL_PHOTO_UNLINKED });
    expect(manualPhotoOf({ ok: false, message: 'El archivo pesa demasiado.' })).toEqual({ ok: false, message: 'El archivo pesa demasiado.' });
  });

  it('does not send what is incomplete, and sends the rest through the door', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: MANUAL_SENT }));
    const base = { map: mapOf(), streetId: 's1', lengthM: 320, entryId: ENTRY, send, now: new Date('2026-11-07T15:00:00.000Z') };
    // Act
    const missing = await runManualProgress({ ...base, draft: { workId: 'base', fromM: 120, toM: 120, photoIds: [], note: '' } });
    const sent = await runManualProgress({ ...base, draft: { workId: 'base', fromM: 120, toM: 240, photoIds: [], note: '' } });
    // Assert
    expect(missing).toEqual({ ok: false, message: MANUAL_NO_LENGTH });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: 'work_manual_progress', from_m: 120, to_m: 240 });
    expect(sent.ok).toBe(true);
  });
});
