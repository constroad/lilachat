import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '../types';
import { NotesViewBand, NotesViewSwitch } from './NotesViewSwitch';
import { readNotesView, useNotesView } from './notesView';

type SwitchChat = Pick<ChatSummary, 'id' | 'kind' | 'linksSorted'>;
const notes: SwitchChat = { id: 'n1', kind: 'notas', linksSorted: true };

afterEach(() => localStorage.clear());

describe('«Chat · Por categoría» (nl-01)', () => {
  it('appears in a notes chat with its links sorted', () => {
    render(<NotesViewSwitch chat={notes} view="chat" onView={vi.fn()} />);
    expect(screen.getByTestId('vista-notas-chat')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('vista-notas-categories')).toHaveTextContent('Por categoría');
  });

  it.each<[string, SwitchChat]>([
    ['a notes chat with the switch off', { id: 'n2', kind: 'notas' }],
    ['a group', { id: 'g1', kind: 'group', linksSorted: true }],
    ['a 1:1', { id: 'd1', kind: 'direct' }],
  ])('does not appear in %s', (_, chat) => {
    render(<><NotesViewSwitch chat={chat} view="chat" onView={vi.fn()} /><NotesViewBand chat={chat} view="chat" onView={vi.fn()} /></>);
    expect(screen.queryByTestId('vista-de-notas')).toBeNull();
  });

  it('picking a view tells which one', () => {
    // Arrange
    const onView = vi.fn();
    render(<NotesViewBand chat={notes} view="chat" onView={onView} />);
    // Act
    fireEvent.click(screen.getByTestId('vista-notas-categories'));
    // Assert
    expect(onView).toHaveBeenCalledWith('categories');
  });

  it('remembers the view of each chat in this browser', () => {
    // Arrange
    const { result, rerender } = renderHook(({ chat }) => useNotesView(chat), { initialProps: { chat: notes } });
    // Act
    act(() => result.current[1]('categories'));
    rerender({ chat: { id: 'n3', kind: 'notas', linksSorted: true } });
    // Assert
    expect(result.current[0]).toBe('chat');
    expect(readNotesView('n1')).toBe('categories');
  });

  it('a chat whose switch went off is always «Chat»', () => {
    localStorage.setItem('lilachat.notesView.n1', 'categories');
    const { result } = renderHook(() => useNotesView({ id: 'n1', kind: 'notas' }));
    expect(result.current[0]).toBe('chat');
  });
});
