import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QUEUE_DISMISSED_KEY, type QueueItem } from '@lilachat/shared';
import { ChatQueue } from './ChatQueue';

const task: QueueItem = { kind: 'task', key: 'task:c1:i1:x', title: 'Acero inspeccionado en losa', context: 'Vaciado de losa', at: new Date(Date.now() - 20 * 3_600_000).toISOString(), checklistId: 'c1', itemId: 'i1', canPostpone: true, seq: 5 };
const event: QueueItem = { kind: 'event', key: 'event:e1:x', title: 'Vaciado del cuarto piso', at: new Date(Date.now() + 4 * 3_600_000).toISOString(), eventId: 'e1', seq: 7 };
const poll: QueueItem = { kind: 'poll', key: 'poll:p1', title: '¿Turno de noche?', pollId: 'p1', seq: 6 };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

function serve(queue: () => QueueItem[]) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return url.includes('/agenda/queue') ? json({ items: queue() }) : json({ ok: true });
  });
  return calls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Backlog 36 (José, 21/10): the queue over the writing bar on the web. */
describe('chat queue (web)', () => {
  it('shows the most urgent card with «1 de N», and «Marcar hecha» ticks the task and moves to the next', async () => {
    let pending = [poll, event, task];
    const calls = serve(() => pending);
    render(<ChatQueue jwt="jwt" chatId="chat1" onOpen={vi.fn()} />);
    expect((await screen.findByTestId('cola-titulo')).textContent).toBe('Acero inspeccionado en losa');
    expect(screen.getByText('1 de 3')).toBeTruthy();
    expect(screen.getByText('Tarea atrasada')).toBeTruthy();
    pending = [poll, event];
    fireEvent.click(screen.getByTestId('cola-done'));
    await waitFor(() => expect(screen.getByTestId('cola-titulo').textContent).toBe('Vaciado del cuarto piso'));
    expect(calls.find((call) => call.url.endsWith('/agenda/checklists/c1/items/i1/toggle'))?.method).toBe('POST');
  });

  it('an event is answered from the card; a poll opens its card in the chat', async () => {
    let pending = [event, poll];
    const calls = serve(() => pending);
    const onOpen = vi.fn();
    render(<ChatQueue jwt="jwt" chatId="chat1" onOpen={onOpen} />);
    pending = [poll];
    fireEvent.click(await screen.findByTestId('cola-yes'));
    await waitFor(() => expect(calls.find((call) => call.url.endsWith('/agenda/events/e1/rsvp'))?.body).toEqual({ rsvp: 'yes' }));
    fireEvent.click(await screen.findByTestId('cola-abrir'));
    expect(onOpen).toHaveBeenCalledWith(6);
  });

  it('the X dismisses it in this browser, and it does not come back', async () => {
    serve(() => [poll]);
    const { unmount } = render(<ChatQueue jwt="jwt" chatId="chat1" onOpen={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('cola-descartar'));
    expect(screen.queryByTestId('cola-del-chat')).toBeNull();
    expect(JSON.parse(localStorage.getItem(QUEUE_DISMISSED_KEY) ?? '[]')).toEqual(['poll:p1']);
    unmount();
    render(<ChatQueue jwt="jwt" chatId="chat1" onOpen={vi.fn()} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('cola-del-chat')).toBeNull();
  });
});
