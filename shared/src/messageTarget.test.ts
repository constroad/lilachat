import { describe, expect, it } from 'vitest';
import { messageTargetOf, messageTargetFields } from './messageTarget.js';

/** José 10/11: a photo, a GIF or a sticker can answer a message or go into a thread, like a text. */
describe('the target of a message', () => {
  it('reads a reply and a thread from JSON numbers or from multipart strings', () => {
    expect(messageTargetOf({ replyToSeq: 12 })).toEqual({ replyToSeq: 12 });
    expect(messageTargetOf({ replyToSeq: '12', hiloDe: '40', enElChat: 'true' })).toEqual({ replyToSeq: 12, hiloDe: 40, enElChat: true });
    expect(messageTargetOf({ hiloDe: 40, enElChat: false })).toEqual({ hiloDe: 40 });
  });

  it('ignores what is not a positive whole number, and «also in the chat» without a thread', () => {
    expect(messageTargetOf({ replyToSeq: '0', hiloDe: '-3' })).toEqual({});
    expect(messageTargetOf({ replyToSeq: 'abc', hiloDe: 1.5 })).toEqual({});
    expect(messageTargetOf({ enElChat: 'true' })).toEqual({});
    expect(messageTargetOf(null)).toEqual({});
  });

  it('writes the multipart fields only for what it has', () => {
    expect(messageTargetFields({})).toEqual([]);
    expect(messageTargetFields({ replyToSeq: 7, hiloDe: 3, enElChat: true })).toEqual([['replyToSeq', '7'], ['hiloDe', '3'], ['enElChat', 'true']]);
  });
});
