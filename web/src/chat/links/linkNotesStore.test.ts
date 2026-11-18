import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkCard } from '@lilachat/shared';
import { forgetLinkNotes, receiveLinksChanged, receiveMessageLink, subscribeMessageLink, useLinkNotes } from './linkNotesStore';

const card = (extra: Partial<LinkCard> = {}): LinkCard => ({ url: 'https://www.instagram.com/reel/abc/', platform: 'instagram', format: 'reel', status: 'ready', author: 'Capi', text: 'Kokoro: voz de estudio', categoryId: 'c1', categoryBy: 'lila', ...extra });
const notes = { enabled: true, categories: [{ id: 'c1', name: 'Video, voz e imagen' }, { id: 'c2', name: 'Claude y skills' }], items: [{ seq: 4, at: '2026-11-09T10:00:00.000Z', link: card() }] };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => {
  forgetLinkNotes();
  vi.unstubAllGlobals();
});

describe('the links of a notes chat in memory', () => {
  it('asks once for every bubble of the same chat', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => ok(notes));
    vi.stubGlobal('fetch', fetchMock);
    // Act
    const first = renderHook(() => useLinkNotes('t', 'n1', true));
    renderHook(() => useLinkNotes('t', 'n1', true));
    // Assert
    await waitFor(() => expect(first.result.current.state.status).toBe('ready'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/n1/links', expect.anything());
  });

  it('msg.link replaces the card of that message and tells the local base', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => ok(notes)));
    const heard = vi.fn();
    const stop = subscribeMessageLink(heard);
    const { result } = renderHook(() => useLinkNotes('t', 'n1', true));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    // Act
    act(() => receiveMessageLink({ chatId: 'n1', seq: 4, link: card({ categoryId: 'c2', categoryBy: 'user' }) }));
    // Assert
    expect(result.current.state.notes?.items[0]?.link.categoryId).toBe('c2');
    expect(heard).toHaveBeenCalledWith({ chatId: 'n1', seq: 4, link: expect.objectContaining({ categoryBy: 'user' }) });
    stop();
  });

  it('a card for a message it did not have asks the view again', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => ok(notes));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLinkNotes('t', 'n1', true));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    // Act
    act(() => receiveMessageLink({ chatId: 'n1', seq: 9, link: card() }));
    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('chat.links.changed reads the view again, keeping the old one on screen', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => ok(notes));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLinkNotes('t', 'n1', true));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    fetchMock.mockResolvedValueOnce(ok({ ...notes, categories: [{ id: 'c1', name: 'Voz' }] }));
    // Act
    act(() => receiveLinksChanged({ chatId: 'n1' }));
    // Assert
    expect(result.current.state.status).toBe('ready');
    await waitFor(() => expect(result.current.state.notes?.categories).toEqual([{ id: 'c1', name: 'Voz' }]));
  });

  it('a failed read says why, and retry asks again', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'No es tu chat.' }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLinkNotes('t', 'n1', true));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.message).toBe('No es tu chat.');
    fetchMock.mockResolvedValueOnce(ok(notes));
    // Act
    act(() => result.current.reload());
    // Assert
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });

  it('does not ask while it is not needed', () => {
    const fetchMock = vi.fn(async () => ok(notes));
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useLinkNotes('t', 'n1', false));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
