import { describe, expect, it } from 'vitest';
import { funAvailable } from './funAvailable';

/**
 * José, 25/10/2026: in Slack mode the «Zumbidos y guiños» switch of a channel was on and the
 * composer never offered them. The channel's switch was read from the personal chat list,
 * which does not hold the chats of a space; the group's detail does.
 */
describe('funAvailable', () => {
  it('a 1:1 always offers them, with no data about the chat', () => {
    expect(funAvailable({ isDraft: false, isGroup: false })).toBe(true);
  });

  it('a draft never does', () => {
    expect(funAvailable({ isDraft: true, isGroup: false })).toBe(false);
    expect(funAvailable({ isDraft: true, isGroup: true, detailAllows: true })).toBe(false);
  });

  it('a channel of a space whose detail says on offers them, though the personal list does not know it', () => {
    expect(funAvailable({ isDraft: false, isGroup: true, detailAllows: true, listAllows: undefined })).toBe(true);
  });

  it('the detail wins over a stale list: an admin turned it off', () => {
    expect(funAvailable({ isDraft: false, isGroup: true, detailAllows: false, listAllows: true })).toBe(false);
  });

  it('while the detail loads, a personal group keeps what its list says (no flicker)', () => {
    expect(funAvailable({ isDraft: false, isGroup: true, detailAllows: undefined, listAllows: true })).toBe(true);
  });

  it('a group nobody switched on does not, and neither one nobody knows about yet', () => {
    expect(funAvailable({ isDraft: false, isGroup: true, detailAllows: false })).toBe(false);
    expect(funAvailable({ isDraft: false, isGroup: true })).toBe(false);
  });
});
