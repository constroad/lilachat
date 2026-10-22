import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityDialog } from './ActivityDialog';

/** «Menciones y actividad» on the web (design e-19). */
let urls: string[] = [];
beforeEach(() => {
  urls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    const type = new URL(url, 'http://x').searchParams.get('type');
    const items = type === 'threads'
      ? [{ chatId: 'c1', seq: 4, at: new Date().toISOString(), chat: { kind: 'group', name: 'planta', channel: true }, author: { id: 'u1', name: 'José' }, body: 'Mi pregunta', unread: true, thread: { replies: 2 } }]
      : [{ chatId: 'c1', seq: 2, at: new Date().toISOString(), chat: { kind: 'group', name: 'planta', channel: true }, author: { id: 'u2', name: 'Beto Ramos' }, body: '@José confirma el despacho', menciones: [{ userId: 'u1', desde: 0, largo: 5 }], unread: true }];
    return new Response(JSON.stringify({ items, unread: { mentions: 1, threads: 1 } }), { status: 200 });
  }));
});

describe('ActivityDialog', () => {
  it('mentions of the space with who, where and the mention; a click opens the message', async () => {
    const onOpen = vi.fn();
    render(<ActivityDialog spaceId="w1" spaceName="QA Obra" jwt="t" myUserId="u1" initialTab="mentions" onOpen={onOpen} onClose={() => undefined} />);
    const card = await screen.findByTestId('actividad-item-c1-2');
    expect(card).toHaveTextContent('Beto Ramos');
    expect(card).toHaveTextContent('#planta');
    // A mention of me reads «@Tú», like in the chat.
    expect(screen.getByText('@Tú')).toBeInTheDocument();
    expect(screen.getByTestId('actividad-mentions')).toHaveTextContent('1');
    expect(urls[0]).toContain('/api/activity?workspace=w1&type=mentions');
    await userEvent.click(screen.getByTestId('responder-c1-2'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ chatId: 'c1', seq: 2 }));
  });

  it('threads say how many replies', async () => {
    render(<ActivityDialog spaceId="w1" spaceName="QA Obra" jwt="t" myUserId="u1" initialTab="threads" onOpen={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByTestId('actividad-item-c1-4')).toHaveTextContent('2 respuestas');
  });
});
