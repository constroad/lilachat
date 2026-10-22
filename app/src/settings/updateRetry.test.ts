import { describe, expect, it } from 'vitest';
import { afterCutDownload, downloadFailedText } from './updateRetry';

const cut = { cut: true, leftTheApp: true, activeNow: false, alreadyResumed: false };

/** José, 22/10: the screen locked while the update downloaded; reopening showed a technical error. */
describe('update download retry', () => {
  it('cut while away: it says so and goes on alone on return', () => {
    expect(downloadFailedText(true)).toBe('La descarga se cortó al bloquearse la pantalla. Sigue sola al volver.');
    expect(afterCutDownload(cut)).toBe('resume-on-return');
  });

  it('the cut shows up once the app is back in front (E2E 22/10): it goes on at once', () => {
    expect(afterCutDownload({ ...cut, activeNow: true })).toBe('resume-now');
  });

  it('cut for another reason, without leaving, or already resumed once: a plain «Reintentar», never the technical text', () => {
    expect(downloadFailedText(false)).toBe('No se pudo descargar la actualización. Toca «Reintentar».');
    expect(afterCutDownload({ ...cut, cut: false })).toBe('none');
    expect(afterCutDownload({ ...cut, leftTheApp: false, activeNow: true })).toBe('none');
    expect(afterCutDownload({ ...cut, alreadyResumed: true, activeNow: true })).toBe('none');
  });
});
