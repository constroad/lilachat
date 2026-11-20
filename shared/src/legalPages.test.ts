import { describe, expect, it } from 'vitest';
import { LEGAL_FOOTER_LINKS, LEGAL_PAGE_PATHS, legalPageOf, legalPageUrl } from './legalPages.js';

describe('legalPageOf', () => {
  it('recognizes each public legal page', () => {
    expect(legalPageOf('/privacidad')).toBe('privacy');
    expect(legalPageOf('/seguridad-infantil')).toBe('childSafety');
  });

  it('tolerates a trailing slash and upper case, as people type addresses', () => {
    expect(legalPageOf('/privacidad/')).toBe('privacy');
    expect(legalPageOf('/Seguridad-Infantil//')).toBe('childSafety');
  });

  it('is null for every other address, so the app keeps its own routes', () => {
    expect(legalPageOf('/')).toBeNull();
    expect(legalPageOf('')).toBeNull();
    expect(legalPageOf('/borrar-cuenta')).toBeNull();
    expect(legalPageOf('/privacidad/extra')).toBeNull();
    expect(legalPageOf('/admin')).toBeNull();
  });
});

describe('legalPageUrl', () => {
  it('builds the public address the APK opens', () => {
    expect(legalPageUrl('privacy')).toBe('https://lilachat.constroad.com/privacidad');
    expect(legalPageUrl('childSafety')).toBe('https://lilachat.constroad.com/seguridad-infantil');
  });
});

describe('LEGAL_FOOTER_LINKS', () => {
  it('lists every legal page once, privacy first', () => {
    expect(LEGAL_FOOTER_LINKS.map((link) => link.label)).toEqual(['Privacidad', 'Seguridad infantil']);
    expect(new Set(LEGAL_FOOTER_LINKS.map((link) => link.id)).size).toBe(Object.keys(LEGAL_PAGE_PATHS).length);
  });
});
