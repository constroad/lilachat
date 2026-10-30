import { describe, expect, it } from 'vitest';
import { askReportPdfUntilDone, nextReportPdfStep, REPORT_PDF_MAX_TRIES, reportPdfOf, reportPdfPath } from './reportPdf.js';

/** A report's PDF asked on demand (agentes 30/10, Portal 588e3ff9: `client.report.requested`). */
describe('reportPdfOf', () => {
  it('reads ready with its https link and generating with a wait bounded to 1–60 s', () => {
    expect(reportPdfOf({ status: 'ready', pdf_url: 'https://lila.example.com/f/1.pdf' })).toEqual({ status: 'ready', pdfUrl: 'https://lila.example.com/f/1.pdf' });
    expect(reportPdfOf({ status: 'generating', retry_after_s: 5 })).toEqual({ status: 'generating', retryAfterS: 5 });
    expect(reportPdfOf({ status: 'generating', retry_after_s: 600 })).toEqual({ status: 'generating', retryAfterS: 60 });
    expect(reportPdfOf({ status: 'generating', retry_after_s: 0.2 })).toEqual({ status: 'generating', retryAfterS: 1 });
    expect(reportPdfOf({ status: 'generating' })).toEqual({ status: 'generating', retryAfterS: 5 });
  });

  it('anything else is no answer: a plain http link, no status, no body', () => {
    expect(reportPdfOf({ status: 'ready', pdf_url: 'http://lila.example.com/f/1.pdf' })).toBeNull();
    expect(reportPdfOf({ pdf_url: 'https://lila.example.com/f/1.pdf' })).toBeNull();
    expect(reportPdfOf(null)).toBeNull();
  });
});

describe('nextReportPdfStep', () => {
  it('opens a ready PDF and waits the time Portal asks while it is generating', () => {
    expect(nextReportPdfStep({ pdf: { status: 'ready', pdfUrl: 'https://l/1.pdf' } }, 1)).toEqual({ kind: 'open', url: 'https://l/1.pdf' });
    expect(nextReportPdfStep({ pdf: { status: 'generating', retryAfterS: 5 } }, 1)).toEqual({ kind: 'wait', ms: 5000 });
  });

  it('gives up after the last try, and a failure says the server message', () => {
    expect(nextReportPdfStep({ pdf: { status: 'generating', retryAfterS: 5 } }, REPORT_PDF_MAX_TRIES)).toEqual({ kind: 'failed', message: 'El PDF sigue generándose en el Portal. Prueba otra vez en unos minutos.' });
    expect(nextReportPdfStep({ message: 'No se pudo traer el PDF del informe' }, 1)).toEqual({ kind: 'failed', message: 'No se pudo traer el PDF del informe' });
    expect(nextReportPdfStep(null, 1)).toEqual({ kind: 'failed', message: 'No se pudo traer el PDF del informe' });
  });

  it('the path names the client, the service and the report', () => {
    expect(reportPdfPath('sp1', 'cli 1', 's1', 'r1')).toBe('/workspaces/sp1/clients/cli%201/services/s1/reports/r1/pdf');
  });
});

describe('askReportPdfUntilDone', () => {
  const generating = { pdf: { status: 'generating' as const, retryAfterS: 5 } };
  const pause = async () => undefined;

  it('asks again after each wait until it is ready', async () => {
    // Arrange
    const answers = [generating, generating, { pdf: { status: 'ready' as const, pdfUrl: 'https://l/1.pdf' } }];
    const ask = async () => answers.shift() ?? null;
    // Act
    const step = await askReportPdfUntilDone(ask, () => true, pause);
    // Assert
    expect(step).toEqual({ kind: 'open', url: 'https://l/1.pdf' });
    expect(answers).toHaveLength(0);
  });

  it('stops at the last try, and returns nothing once the sheet is closed', async () => {
    let asked = 0;
    const always = async () => ((asked += 1), generating);
    expect(await askReportPdfUntilDone(always, () => true, pause)).toMatchObject({ kind: 'failed' });
    expect(asked).toBe(REPORT_PDF_MAX_TRIES);
    let open = true;
    const closing = async () => ((open = false), generating);
    expect(await askReportPdfUntilDone(closing, () => open, pause)).toBeNull();
  });
});
