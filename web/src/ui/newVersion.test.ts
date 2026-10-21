import { describe, expect, it } from 'vitest';
import { WEB_VERSION_RECHECK_MS, bundleOf, hasNewBundle, shouldRecheckWeb } from './newVersion';

const html = (bundle: string) => `<!doctype html><html><head><script src="/tema-inicial.js"></script><script type="module" crossorigin src="/assets/${bundle}"></script></head></html>`;

/** Backlog 32 for the web (José, 21/10): a tab left open for days keeps the old bundle. */
describe('a new web version', () => {
  it('reads the bundle a published index.html loads', () => {
    expect(bundleOf(html('index-CyINjmYm.js'))).toBe('/assets/index-CyINjmYm.js');
    expect(bundleOf('<html><body>sin script</body></html>')).toBeNull();
  });
  it('is new when the published bundle differs from the loaded one', () => {
    expect(hasNewBundle('/assets/index-CyINjmYm.js', html('index-Ab12Cd34.js'))).toBe(true);
    expect(hasNewBundle('/assets/index-CyINjmYm.js', html('index-CyINjmYm.js'))).toBe(false);
  });
  it('a dev server (no hashed bundle) or a page that did not answer never claims a new version', () => {
    expect(hasNewBundle(null, html('index-Ab12Cd34.js'))).toBe(false);
    expect(hasNewBundle('/assets/index-CyINjmYm.js', '<html>error</html>')).toBe(false);
  });
  it('asks again when coming back to the tab, at most every 30 min', () => {
    const now = Date.UTC(2026, 9, 21, 15);
    expect(shouldRecheckWeb(null, now)).toBe(true);
    expect(shouldRecheckWeb(now - 60_000, now)).toBe(false);
    expect(shouldRecheckWeb(now - WEB_VERSION_RECHECK_MS, now)).toBe(true);
  });
});
