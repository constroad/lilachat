import { describe, expect, it } from 'vitest';
import { EMBED_MIN_WIDTH_PX, PORTAL_EMBED_ORIGINS, createsInEmbed, embedCloseRequest, embedCreateRequest, nativeEmbedCommand, nativeEmbedEventOf, embedErrorLine, embedEventOf, embedLinkOf, embedReportIdOf, embedTheme, opensEmbed, reportEmbedCreatePath } from './portalEmbed.js';

/** Portal's editor 2.0 framed in Lilachat web (Portal 11/11: `/embed/report/<id>#t=<token>`, messages v1). */
const prod = [PORTAL_EMBED_ORIGINS.production];
const link = { url: 'https://www.constroad.com/embed/report/6731f0a2b4c5d6e7f8091a2b#t=abc.DEF_123-x', expires_at: '2026-11-12T08:00:00.000Z' };

describe('embedLinkOf', () => {
  it('reads Portal\'s link and its expiry', () => {
    expect(embedLinkOf(link, prod)).toEqual({ url: link.url, expiresAt: '2026-11-12T08:00:00.000Z' });
  });

  it('reads its own output again (the server parses it and the web checks what the server sent)', () => {
    const once = embedLinkOf(link, prod)!;
    expect(embedLinkOf(JSON.parse(JSON.stringify(once)), prod)).toEqual(once);
  });

  it('refuses another origin, another path, plain http or a link without its token', () => {
    expect(embedLinkOf({ ...link, url: 'https://constroad.com/embed/report/r1#t=abc' }, prod)).toBeNull();
    expect(embedLinkOf({ ...link, url: 'https://www.constroad.com/admin/report/r1#t=abc' }, prod)).toBeNull();
    expect(embedLinkOf({ ...link, url: 'http://www.constroad.com/embed/report/r1#t=abc' }, prod)).toBeNull();
    expect(embedLinkOf({ ...link, url: 'https://www.constroad.com/embed/report/r1' }, prod)).toBeNull();
    expect(embedLinkOf({ ...link, url: 'https://www.constroad.com/embed/report/r1#t=' }, prod)).toBeNull();
    expect(embedLinkOf({ ...link, url: 'https://evil.com/?https://www.constroad.com/embed/report/r1#t=abc' }, prod)).toBeNull();
  });

  it('the local Portal only where the caller allows it', () => {
    const local = { ...link, url: 'http://localhost:3000/embed/report/r1#t=abc' };
    expect(embedLinkOf(local, prod)).toBeNull();
    expect(embedLinkOf(local, [PORTAL_EMBED_ORIGINS.production, 'http://localhost:3000'])?.url).toBe(local.url);
  });

  it('without a valid expiry or a url it is not an answer', () => {
    expect(embedLinkOf({ url: link.url, expires_at: 'mañana' }, prod)).toBeNull();
    expect(embedLinkOf({ expires_at: link.expires_at }, prod)).toBeNull();
    expect(embedLinkOf(null, prod)).toBeNull();
  });
});

describe('embedEventOf', () => {
  it('reads each of Portal\'s six messages', () => {
    expect(embedEventOf({ type: 'portal-embed:ready', version: 1 })).toEqual({ type: 'ready' });
    expect(embedEventOf({ type: 'portal-embed:dirty', version: 1, dirty: true })).toEqual({ type: 'dirty', dirty: true });
    expect(embedEventOf({ type: 'portal-embed:saved', version: 1, reportId: 'r1', savedAt: '2026-11-11T20:00:00.000Z' })).toEqual({ type: 'saved', reportId: 'r1', savedAt: '2026-11-11T20:00:00.000Z' });
    expect(embedEventOf({ type: 'portal-embed:published', version: 1, reportId: 'r1', pdfUrl: 'https://lila.constroad.com/f/r1.pdf' })).toEqual({ type: 'published', reportId: 'r1', pdfUrl: 'https://lila.constroad.com/f/r1.pdf' });
    expect(embedEventOf({ type: 'portal-embed:closed', version: 1 })).toEqual({ type: 'closed' });
    expect(embedEventOf({ type: 'portal-embed:error', version: 1, code: 'expired' })).toEqual({ type: 'error', code: 'expired' });
  });

  it('a published report without an https PDF goes without its link', () => {
    expect(embedEventOf({ type: 'portal-embed:published', version: 1, reportId: 'r1', pdfUrl: 'javascript:alert(1)' })).toEqual({ type: 'published', reportId: 'r1' });
  });

  it('another version, another prefix, a missing field or anything else is ignored', () => {
    expect(embedEventOf({ type: 'portal-embed:ready', version: 2 })).toBeNull();
    expect(embedEventOf({ type: 'portal-embed:ready' })).toBeNull();
    expect(embedEventOf({ type: 'other:ready', version: 1 })).toBeNull();
    expect(embedEventOf({ type: 'portal-embed:saved', version: 1, savedAt: 'x' })).toBeNull();
    expect(embedEventOf({ type: 'portal-embed:dirty', version: 1, dirty: 'yes' })).toBeNull();
    expect(embedEventOf({ type: 'portal-embed:error', version: 1 })).toBeNull();
    expect(embedEventOf('portal-embed:ready')).toBeNull();
  });
});

describe('what Lilachat sends', () => {
  it('close-request and theme, each with version 1', () => {
    expect(embedCloseRequest()).toEqual({ type: 'portal-embed:close-request', version: 1 });
    expect(embedTheme('dark')).toEqual({ type: 'portal-embed:theme', version: 1, mode: 'dark' });
  });
});

describe('opensEmbed', () => {
  it('only a report Portal marks as editor 2.0, on a window of 1024 px or more', () => {
    expect(opensEmbed(EMBED_MIN_WIDTH_PX, { editor: 'v2' })).toBe(true);
    expect(opensEmbed(EMBED_MIN_WIDTH_PX - 1, { editor: 'v2' })).toBe(false);
    expect(opensEmbed(1440, {})).toBe(false);
  });
});

describe('embedErrorLine', () => {
  it('says why in words, never the code', () => {
    expect(embedErrorLine('not-found')).toBe('Este informe ya no está en el Portal.');
    expect(embedErrorLine('not_found')).toBe('Este informe ya no está en el Portal.');
    expect(embedErrorLine('forbidden')).toMatch(/permiso/);
    expect(embedErrorLine('whatever')).toBe('No se pudo abrir el editor del Portal.');
  });
});

describe('creating a report in the editor (José 12/11: «en la web, el editor; formularios solo en la APK y la PWA móvil»)', () => {
  it('on a wide window the five editor types are created in Portal\'s editor; the rest keep their way', () => {
    for (const type of ['CTL-PIS', 'CTL-IMP', 'REG-OBS', 'LEV-OBS', 'CON-CAP']) expect(createsInEmbed(EMBED_MIN_WIDTH_PX, type)).toBe(true);
    expect(createsInEmbed(EMBED_MIN_WIDTH_PX - 1, 'CTL-IMP')).toBe(false);
    expect(createsInEmbed(1440, 'IAA')).toBe(false);
    expect(createsInEmbed(1440, 'VAL-SRV')).toBe(false);
  });

  it('the new report\'s id comes from its link, so an expired link asks for that report and never creates another', () => {
    expect(embedReportIdOf('https://www.constroad.com/embed/report/6aee7f1a4dac30603af48028#t=abc')).toBe('6aee7f1a4dac30603af48028');
    expect(embedReportIdOf('https://www.constroad.com/admin/report/r1')).toBeNull();
    expect(embedReportIdOf('no es url')).toBeNull();
  });

  it('the create request carries the type and, when written, the responsible', () => {
    expect(embedCreateRequest('CTL-IMP', '  Ana Torres ')).toEqual({ type: 'CTL-IMP', responsible: 'Ana Torres' });
    expect(embedCreateRequest('REG-OBS', '')).toEqual({ type: 'REG-OBS' });
    expect(reportEmbedCreatePath('w1', 'c 1', 's1')).toBe('/workspaces/w1/clients/c%201/services/s1/reports/embed');
  });
});

describe('the visit\'s croquis in Portal\'s embed (Portal 14/11, main 29a6e408)', () => {
  const croquis = { url: 'https://www.constroad.com/embed/site-visit/6af86624b29826f4d5c7e082?vista=croquis#t=abc.DEF_123-x', expires_at: '2026-11-14T20:00:00.000Z' };

  it('reads the croquis link when the caller asks for a visit', () => {
    expect(embedLinkOf(croquis, prod, 'site-visit')).toEqual({ url: croquis.url, expiresAt: '2026-11-14T20:00:00.000Z' });
  });

  it('reads the visit\'s sheet too (the same path without «vista»)', () => {
    const sheet = { ...croquis, url: 'https://www.constroad.com/embed/site-visit/6af86624b29826f4d5c7e082#t=abc' };
    expect(embedLinkOf(sheet, prod, 'site-visit')?.url).toBe(sheet.url);
  });

  it('refuses a visit link where a report is asked, and any other view', () => {
    expect(embedLinkOf(croquis, prod)).toBeNull();
    expect(embedLinkOf(link, prod, 'site-visit')).toBeNull();
    expect(embedLinkOf({ ...croquis, url: croquis.url.replace('vista=croquis', 'vista=admin') }, prod, 'site-visit')).toBeNull();
    expect(embedLinkOf({ ...croquis, url: croquis.url.replace('#t=abc.DEF_123-x', '') }, prod, 'site-visit')).toBeNull();
  });

  it('reads «saved» with the visit\'s id', () => {
    expect(embedEventOf({ type: 'portal-embed:saved', version: 1, visitId: 'v1', savedAt: '2026-11-14T14:00:00.000Z' })).toEqual({ type: 'saved', visitId: 'v1', savedAt: '2026-11-14T14:00:00.000Z' });
  });
});

describe('the bridge with the APK\'s WebView (Portal 8d2fe4a5: window.ReactNativeWebView)', () => {
  it('reads Portal\'s message as the JSON text the WebView hands over', () => {
    expect(nativeEmbedEventOf(JSON.stringify({ type: 'portal-embed:closed', version: 1 }))).toEqual({ type: 'closed' });
    expect(nativeEmbedEventOf(JSON.stringify({ type: 'portal-embed:dirty', version: 1, dirty: true }))).toEqual({ type: 'dirty', dirty: true });
  });

  it('ignores what is not JSON or not Portal\'s', () => {
    expect(nativeEmbedEventOf('not json')).toBeNull();
    expect(nativeEmbedEventOf(JSON.stringify({ type: 'other', version: 1 }))).toBeNull();
    expect(nativeEmbedEventOf(JSON.stringify({ type: 'portal-embed:closed', version: 2 }))).toBeNull();
  });

  it('writes the close request as the text the WebView posts', () => {
    expect(JSON.parse(nativeEmbedCommand(embedCloseRequest()))).toEqual({ type: 'portal-embed:close-request', version: 1 });
  });
});
