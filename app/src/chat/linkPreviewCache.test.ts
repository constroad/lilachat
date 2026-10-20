import { describe, expect, it } from 'vitest';
import { PREVIEW_CACHE_LIMIT, rememberPreview } from './linkPreviewCache';

/**
 * The link card was born with 0 height and grew ~200 dp when its preview came
 * back, pushing the chat on every open after a restart (E2E, 20/10). The
 * previews already seen are kept on the phone.
 */
describe('rememberPreview', () => {
  const preview = (title: string) => ({ url: `https://x.test/${title}`, titulo: title, sitio: 'x.test' });

  it('keeps the newest last and does not repeat a url', () => {
    const entries = rememberPreview([['a', preview('a')], ['b', null]], 'a', preview('a2'));
    expect(entries.map(([url]) => url)).toEqual(['b', 'a']);
    expect(entries[1]![1]).toMatchObject({ titulo: 'a2' });
  });

  it('remembers «this page has no card» too (null), so no room is reserved for it', () => {
    expect(rememberPreview([], 'n', null)).toEqual([['n', null]]);
  });

  it('drops the oldest past the limit', () => {
    const full = Array.from({ length: PREVIEW_CACHE_LIMIT }, (_, index) => [`u${index}`, null] as [string, null]);
    const entries = rememberPreview(full, 'new', null);
    expect(entries).toHaveLength(PREVIEW_CACHE_LIMIT);
    expect(entries[0]![0]).toBe('u1');
    expect(entries.at(-1)![0]).toBe('new');
  });
});
