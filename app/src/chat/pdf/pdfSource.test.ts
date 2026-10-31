import { describe, expect, it } from 'vitest';
import { chatPdfs, isPdf, pdfCacheName, pdfDownloadCodeOf, pdfFailureFrom, PDF_FAILURE_TEXT } from './pdfSource';

const pdf = (seq: number, extra: object = {}) => ({ seq, at: `2026-10-22T1${seq}:00:00Z`, media: { url: `https://x/${seq}.pdf`, mime: 'application/pdf', fileName: `Plano ${seq}.pdf` }, ...extra });

describe('pdfSource', () => {
  it('lists the chat\'s PDFs newest first, without photos, deleted or pending ones', () => {
    // Arrange
    const messages = [pdf(1), { seq: 2, at: 'x', media: { url: 'https://x/2.jpg', mime: 'image/jpeg' } }, pdf(3, { deletedAt: '2026-10-22' }), pdf(4), pdf(-1), { seq: 5, at: 'x', media: { mime: 'application/pdf' } }];
    // Act
    const pdfs = chatPdfs(messages);
    // Assert
    expect(pdfs.map((one) => one.seq)).toEqual([4, 1]);
    expect(pdfs[0]).toEqual({ seq: 4, url: 'https://x/4.pdf', name: 'Plano 4.pdf', at: '2026-10-22T14:00:00Z', mime: 'application/pdf' });
  });

  it('a PDF without a name still has one', () => {
    // Act
    const [only] = chatPdfs([{ seq: 7, at: 'x', media: { url: 'https://x/7', mime: 'application/pdf', fileName: '  ' } }]);
    // Assert
    expect(only?.name).toBe('Documento PDF');
  });

  it('only the PDF mime opens in the viewer', () => {
    // Act / Assert
    expect(isPdf('application/pdf')).toBe(true);
    expect(isPdf('application/msword')).toBe(false);
    expect(isPdf(undefined)).toBe(false);
  });

  it('names the working copy by file, not by message: a seq repeats in every chat', () => {
    // Act
    const first = pdfCacheName('https://lila.constroad.com/files/a.pdf');
    // Assert
    expect(first).toMatch(/^pdf-view-[a-z0-9-]+\.pdf$/);
    expect(pdfCacheName('https://lila.constroad.com/files/a.pdf')).toBe(first);
    expect(pdfCacheName('https://lila.constroad.com/files/b.pdf')).not.toBe(first);
  });

  it('reads the renderer\'s codes and anything else as damaged', () => {
    // Act / Assert
    expect(pdfFailureFrom({ code: 'ERR_PDF_PROTECTED' })).toBe('protected');
    expect(pdfFailureFrom({ code: 'ERR_PDF_DOWNLOAD' })).toBe('download');
    expect(pdfFailureFrom(new Error('boom'))).toBe('damaged');
    expect(pdfFailureFrom(null)).toBe('damaged');
    expect(PDF_FAILURE_TEXT.protected).toContain('contraseña');
  });

  it('a Portal PDF that did not come says why (quote-pdf: 202 for too long, 401, 404/409); a 5xx is the download\'s', () => {
    // Act / Assert
    expect(pdfFailureFrom({ code: 'ERR_PDF_GENERATING' })).toBe('generating');
    expect(pdfFailureFrom({ code: 'ERR_PDF_EXPIRED' })).toBe('expired');
    expect(pdfFailureFrom({ code: 'ERR_PDF_MISSING' })).toBe('missing');
    expect(PDF_FAILURE_TEXT.generating).toContain('preparando');
    expect(pdfDownloadCodeOf('failed')).toBe('ERR_PDF_DOWNLOAD');
    expect(pdfDownloadCodeOf('missing')).toBe('ERR_PDF_MISSING');
    expect(pdfDownloadCodeOf('ready')).toBeNull();
  });
});
