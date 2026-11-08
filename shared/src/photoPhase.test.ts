import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms.js';
import { PHOTO_PHASE_SAVED, PHOTO_MARKS_MAX, photoMarkOf, photoPhaseDraftOf, withPhotoMark, photoMarksOf, photoPhaseLabel, photoPhaseRequest, sendPhotoPhase, stretchKey } from './photoPhase.js';

/** José 08/11 through Portal: mark a photo as «antes» or «después» from Lilachat's viewer. */
describe('photoMarksOf', () => {
  it('keeps the marks of Portal\'s detail, renamed, and drops what is off the contract', () => {
    const marks = photoMarksOf([
      { fotoId: 'f1', fase: 'antes', tramo: ' Jr. Conchucos cdra 1 ' },
      { fotoId: 'f2', fase: 'despues', tramo: '' },
      { fotoId: 'f3', fase: 'durante', tramo: 'x' },
      { fase: 'antes', tramo: 'x' },
      { fotoId: 'f4', fase: 'antes', tramo: 'x'.repeat(81) },
    ]);
    expect(marks).toEqual([
      { photoId: 'f1', phase: 'antes', stretch: 'Jr. Conchucos cdra 1' },
      { photoId: 'f2', phase: 'despues', stretch: '' },
    ]);
  });

  it('reads nothing from what is not a list, and at most 200', () => {
    expect(photoMarksOf(undefined)).toEqual([]);
    expect(photoMarksOf({ fotoId: 'f1' })).toEqual([]);
    expect(photoMarksOf(Array.from({ length: 250 }, (_, index) => ({ fotoId: `f${index}`, fase: 'antes', tramo: '' })))).toHaveLength(PHOTO_MARKS_MAX);
  });

  it('finds the mark of one photo', () => {
    const marks = photoMarksOf([{ fotoId: 'f1', fase: 'antes', tramo: 'Cdra 1' }]);
    expect(photoMarkOf(marks, 'f1')).toEqual({ photoId: 'f1', phase: 'antes', stretch: 'Cdra 1' });
    expect(photoMarkOf(marks, 'f9')).toBeNull();
  });
});

describe('stretchKey', () => {
  it('pairs a «before» and an «after» whatever their capitals, accents and spaces', () => {
    expect(stretchKey('  JIRÓN  Conchucos cdra 1')).toBe(stretchKey('jiron conchucos cdra 1'));
  });
});

describe('photoPhaseRequest', () => {
  it('sends the phase and the stretch; null takes the mark away', () => {
    expect(photoPhaseRequest('f1', 'antes', ' Cdra 1 ')).toEqual({ kind: 'photo_phase', photo_id: 'f1', phase: 'antes', stretch: 'Cdra 1', forms: FORMS_LEVEL });
    expect(photoPhaseRequest('f1', null)).toEqual({ kind: 'photo_phase', photo_id: 'f1', phase: null, forms: FORMS_LEVEL });
  });

  it('leaves an empty stretch out, so the photo keeps the one it had', () => {
    expect(photoPhaseRequest('f1', 'despues', '  ')).not.toHaveProperty('stretch');
  });
});

describe('photoPhaseLabel', () => {
  it('says the phase and its stretch', () => {
    expect(photoPhaseLabel({ photoId: 'f1', phase: 'antes', stretch: 'Cdra 1' })).toBe('Antes · Cdra 1');
    expect(photoPhaseLabel({ photoId: 'f1', phase: 'despues', stretch: '' })).toBe('Después');
    expect(photoPhaseLabel(null)).toBe('Sin marcar');
  });
});

describe('sendPhotoPhase', () => {
  it('opens the door, confirms with nothing to fill and reads Portal\'s answer', async () => {
    const deps = {
      open: vi.fn(async () => ({ ok: true as const, data: { commandId: 'c1', appId: 'a', appName: 'Portal', outcome: 'form' as const } })),
      submit: vi.fn(async () => ({ ok: true as const, outcome: { outcome: 'done' as const, response: { responseType: 'text' as const, text: '' } } })),
      notice: vi.fn(async () => null),
    };
    expect(await sendPhotoPhase(deps)).toEqual({ ok: true, message: PHOTO_PHASE_SAVED });
    expect(deps.submit).toHaveBeenCalledWith('c1', {});
  });
});

describe('withPhotoMark', () => {
  const marks = [{ photoId: 'f1', phase: 'antes' as const, stretch: 'Cdra 1' }, { photoId: 'f2', phase: 'despues' as const, stretch: 'Cdra 2' }];

  it('replaces the photo\'s mark, keeping its stretch when none came', () => {
    expect(withPhotoMark(marks, 'f1', 'despues', ' ')).toEqual([marks[1], { photoId: 'f1', phase: 'despues', stretch: 'Cdra 1' }]);
    expect(withPhotoMark(marks, 'f3', 'antes', 'Cdra 3')).toEqual([...marks, { photoId: 'f3', phase: 'antes', stretch: 'Cdra 3' }]);
  });

  it('null takes the mark out', () => {
    expect(withPhotoMark(marks, 'f1', null, '')).toEqual([marks[1]]);
  });

  it('the bar starts from the photo\'s mark, or empty', () => {
    expect(photoPhaseDraftOf(marks[0]!)).toEqual({ phase: 'antes', stretch: 'Cdra 1', busy: false, answer: null });
    expect(photoPhaseDraftOf(null)).toEqual({ phase: null, stretch: '', busy: false, answer: null });
  });
});
