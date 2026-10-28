import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDrafts, readDraft, saveDraft } from './chatDrafts';

describe('chatDrafts', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('a chat without a draft reads as empty', () => {
    expect(readDraft('chat-a')).toBe('');
  });

  it('keeps one draft per chat', () => {
    saveDraft('chat-a', 'hola');
    saveDraft('chat-b', 'otra cosa');
    expect(readDraft('chat-a')).toBe('hola');
    expect(readDraft('chat-b')).toBe('otra cosa');
  });

  it('keeps the text as typed, spaces included', () => {
    saveDraft('chat-a', '  hola\ncomo estas  ');
    expect(readDraft('chat-a')).toBe('  hola\ncomo estas  ');
  });

  it('an empty or blank text removes the draft', () => {
    saveDraft('chat-a', 'hola');
    saveDraft('chat-a', '   \n');
    expect(readDraft('chat-a')).toBe('');
    expect(localStorage.length).toBe(0);
  });

  it('overwrites the previous draft of the same chat', () => {
    saveDraft('chat-a', 'hola');
    saveDraft('chat-a', 'hola de nuevo');
    expect(readDraft('chat-a')).toBe('hola de nuevo');
  });

  it('forgetDrafts removes every draft and nothing else', () => {
    localStorage.setItem('lilachat.birthdayCards.seen', '["x"]');
    saveDraft('chat-a', 'hola');
    saveDraft('chat-b', 'otra cosa');
    forgetDrafts();
    expect(readDraft('chat-a')).toBe('');
    expect(readDraft('chat-b')).toBe('');
    expect(localStorage.getItem('lilachat.birthdayCards.seen')).toBe('["x"]');
  });

  it('without storage nothing breaks: reads empty and writes are ignored', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => saveDraft('chat-a', 'hola')).not.toThrow();
    expect(readDraft('chat-a')).toBe('');
    expect(() => forgetDrafts()).not.toThrow();
  });
});
