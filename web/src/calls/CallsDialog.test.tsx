import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CallsDialog, CallsHistory } from './CallsDialog';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const calls = [
  { chatId: 'c1', seq: 9, at: '2026-10-22T15:00:00.000Z', valor: 'video:perdida', mine: false, title: 'Wilson', phone: '987654321' },
  { chatId: 'c2', seq: 4, at: '2026-10-21T15:00:00.000Z', valor: 'voz:133', mine: true, title: 'Obra Chancay', phone: null },
];
const names: Record<string, string> = { c1: 'Wilson', c2: 'Obra Chancay' };
// Outside a CallProvider the calls context has its no-op default: enough to read names.
const CallsHistoryForTest = () => <CallsHistory jwt="jwt" chats={[]} onOpen={vi.fn()} onClose={vi.fn()} />;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Pending 38 (José, 21/10): «Llamadas» in the web's rail. */
describe('CallsDialog', () => {
  it('lists the calls with who, what happened, and calls back with the same kind', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { calls }));
    const onCall = vi.fn();
    render(<CallsDialog jwt="jwt" chatName={(line) => names[line.chatId] ?? 'Conversación'} onOpen={vi.fn()} onCall={onCall} onClose={vi.fn()} />);

    expect(await screen.findByText('Wilson')).toBeTruthy();
    expect(screen.getByText(/Videollamada perdida/)).toBeTruthy();
    expect(screen.getByText(/Llamada de voz · 02:13/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('llamar-c1-9'));
    expect(onCall).toHaveBeenCalledWith('c1', 'Wilson', true);
  });

  it('without the chat in the list yet, the server’s title names the row', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { calls }));
    render(<CallsHistoryForTest />);
    expect(await screen.findByText('Wilson')).toBeTruthy();
    expect(screen.getByText('Obra Chancay')).toBeTruthy();
  });

  it('opens the chat of a row', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { calls }));
    const onOpen = vi.fn();
    render(<CallsDialog jwt="jwt" chatName={(line) => names[line.chatId] ?? 'Conversación'} onOpen={onOpen} onCall={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('llamada-c2-4'));
    expect(onOpen).toHaveBeenCalledWith('c2');
  });

  it('reopening paints the last answer at once while it asks again', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { calls }));
    render(<CallsDialog jwt="jwt-reopen" chatName={(line) => names[line.chatId] ?? 'X'} onOpen={vi.fn()} onCall={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Wilson');
    cleanup();
    fetchMock.mockReturnValue(new Promise(() => undefined));
    render(<CallsDialog jwt="jwt-reopen" chatName={(line) => names[line.chatId] ?? 'X'} onOpen={vi.fn()} onCall={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Wilson')).toBeTruthy();
  });

  it('an empty history says so, and a failure is not shown as empty', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(200, { calls: [] }));
    render(<CallsDialog jwt="jwt-empty" chatName={() => 'X'} onOpen={vi.fn()} onCall={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText('Todavía no hay llamadas.')).toBeTruthy();
    cleanup();
    fetchMock.mockResolvedValueOnce(json(500, { message: 'No se pudo cargar.' }));
    render(<CallsDialog jwt="jwt-failing" chatName={() => 'X'} onOpen={vi.fn()} onCall={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText('No se pudo cargar.')).toBeTruthy();
    expect(screen.queryByText('Todavía no hay llamadas.')).toBeNull();
  });
});
