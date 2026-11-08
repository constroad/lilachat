import { describe, expect, it, vi } from 'vitest';
import { FORMS_LEVEL } from './appForms.js';
import { createProgressPdf, PROGRESS_PDF_MAX_TRIES, PROGRESS_PDF_MISSING, PROGRESS_PDF_SLOW, progressPdfUrlOf, progressPdfWaitOf, workProgressPdfRequest } from './workProgressPdf.js';
import type { MapEditSend } from './workScopeDraft.js';

/** The map's PDFs (Portal 02cfceef): the client's sheet (o-08) and the plan (o-12). */
const PDF = 'https://lila.constroad.com/files/avance.pdf';

describe('workProgressPdfRequest', () => {
  it('the client sheet carries the cut; the plan also its size and the work picked', () => {
    expect(workProgressPdfRequest({ stageId: 'e1', untilDay: '2026-11-06', workId: 'base' }, 'client')).toEqual({ kind: 'work_progress_pdf', stage_id: 'e1', until: '2026-11-06', format: 'client', forms: FORMS_LEVEL });
    expect(workProgressPdfRequest({ workId: 'base' }, 'plan', 'A1')).toEqual({ kind: 'work_progress_pdf', format: 'plan', size: 'A1', work_ids: ['base'], forms: FORMS_LEVEL });
  });
});

describe('the answer', () => {
  it('opens only a ready https link', () => {
    expect(progressPdfUrlOf({ status: 'ready', url: PDF })).toBe(PDF);
    expect(progressPdfUrlOf({ status: 'ready', url: 'http://x/a.pdf' })).toBeNull();
    expect(progressPdfUrlOf({ status: 'generating' })).toBeNull();
  });

  it('reads the link, or says it did not come, or Portal\'s refusal', async () => {
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: { status: 'ready', url: PDF } }));
    expect(await createProgressPdf(send, {}, 'client')).toEqual({ ok: true, url: PDF });
    expect(await createProgressPdf(async () => ({ ok: true, message: '' }), {}, 'plan', 'A3')).toEqual({ ok: false, message: PROGRESS_PDF_MISSING });
    expect(await createProgressPdf(async () => ({ ok: false, message: 'Esa etapa no es de este servicio.' }), {}, 'client')).toEqual({ ok: false, message: 'Esa etapa no es de este servicio.' });
  });
});

describe('a sheet that takes a while (Portal ed331de6)', () => {
  it('waits what Portal says and asks again with the same values', async () => {
    // Arrange
    const answers = [{ status: 'generating', retry_after_s: 10 }, { status: 'generating', retry_after_s: 10 }, { status: 'ready', url: PDF }];
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: answers.shift() }));
    const wait = vi.fn(async () => undefined);
    // Act
    const result = await createProgressPdf(send, { stageId: 'e1' }, 'client', undefined, wait);
    // Assert
    expect(result).toEqual({ ok: true, url: PDF });
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(10_000);
    expect(send.mock.calls[2]![0]).toEqual(send.mock.calls[0]![0]);
  });

  it('gives up after a few asks, and keeps the wait within bounds', async () => {
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: '', data: { status: 'generating' } }));
    expect(await createProgressPdf(send, {}, 'plan', 'A3', async () => undefined)).toEqual({ ok: false, message: PROGRESS_PDF_SLOW });
    expect(send).toHaveBeenCalledTimes(PROGRESS_PDF_MAX_TRIES);
    expect(progressPdfWaitOf({ status: 'generating', retry_after_s: 0 })).toBe(2);
    expect(progressPdfWaitOf({ status: 'generating', retry_after_s: 600 })).toBe(30);
    expect(progressPdfWaitOf({ status: 'ready' })).toBeNull();
  });
});
