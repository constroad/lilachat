import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PendingMarker } from './PendingMarker';
import { forgetPendingInChats, forgetPendingKey, refreshPendingInChats } from './pendingInChats';

/** José, 22/10: the cards were great, but the chat list did not say a chat had something waiting. */
describe('pending marker in the chat list', () => {
  afterEach(() => {
    forgetPendingInChats();
    localStorage.clear();
  });

  it('shows how many things wait in the chat, without the ones dismissed here, and goes when acted on', async () => {
    localStorage.setItem('lilachat.queue-dismissed', JSON.stringify(['poll:p1']));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ pending: { c1: ['task:t1', 'poll:p1', 'event:e1'] } }), { status: 200 })));
    render(<><PendingMarker chatId="c1" /><PendingMarker chatId="c2" /></>);
    await act(() => refreshPendingInChats('jwt'));
    expect(screen.getByTestId('pendiente-c1')).toHaveTextContent('2');
    expect(screen.queryByTestId('pendiente-c2')).toBeNull();
    act(() => forgetPendingKey('task:t1'));
    expect(screen.getByTestId('pendiente-c1')).toHaveTextContent('1');
    act(() => forgetPendingKey('event:e1'));
    expect(screen.queryByTestId('pendiente-c1')).toBeNull();
  });
});
