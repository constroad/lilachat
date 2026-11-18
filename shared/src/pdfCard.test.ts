import { describe, expect, it } from 'vitest';
import { isPdfMedia, pdfCardLineOf } from './pdfCard.js';

describe('a PDF in the chat (José 17/11: its first page, like WhatsApp)', () => {
  it('knows a PDF by its type or, when it came generic, by its name', () => {
    expect(isPdfMedia({ mime: 'application/pdf' })).toBe(true);
    expect(isPdfMedia({ mime: 'application/octet-stream', fileName: 'Cotizacion-103.PDF' })).toBe(true);
    expect(isPdfMedia({ mime: 'image/jpeg', fileName: 'foto.jpg' })).toBe(false);
    expect(isPdfMedia({ mime: 'application/octet-stream', fileName: 'metrado.kml' })).toBe(false);
    expect(isPdfMedia({})).toBe(false);
  });

  it('says its pages, its size and that it is a PDF; what it does not know it leaves out', () => {
    expect(pdfCardLineOf({ pages: 1, sizeBytes: 255 * 1024 })).toBe('1 página · 255 KB · PDF');
    expect(pdfCardLineOf({ pages: 14, sizeBytes: 3 * 1024 * 1024 })).toBe('14 páginas · 3.0 MB · PDF');
    expect(pdfCardLineOf({ sizeBytes: 900 })).toBe('900 B · PDF');
    expect(pdfCardLineOf({})).toBe('PDF');
  });
});
