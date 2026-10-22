import { describe, expect, it } from 'vitest';
import { webVersionLabel } from './webVersion';

/** José, 21/10: «en la web muéstrame qué versión está ejecutando». */
describe('web version label', () => {
  it('says the version, the commit and when it was built, in Lima time', () => {
    expect(webVersionLabel({ version: '0.1.128', commit: '6914ede', builtAt: '2026-10-22T02:05:00.000Z' })).toBe('Lilachat web 0.1.128 · 6914ede · 21/10 21:05');
  });

  it('without a commit or a build time (a dev server), only what it knows', () => {
    expect(webVersionLabel({ version: 'dev', commit: '', builtAt: '' })).toBe('Lilachat web dev');
  });
});
