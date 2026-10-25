import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardPerson } from '@lilachat/shared';
import type { ChatSummary } from '../types';
import { usePersonCardWeb } from './usePersonCardWeb';

/**
 * José, 25/10/2026: from a person's name or photo, a card whose «Enviar mensaje» opens the 1:1
 * (or creates it, in the same space). A bot that does not take direct messages is never offered.
 */
const ana: CardPerson = { userId: 'u-ana', name: 'Ana', phone: '999111222', avatarUrl: null, isApp: false, badge: 'Capataz' };
const bot: CardPerson = { userId: 'u-bot', name: 'Portal', phone: null, avatarUrl: null, isApp: true, badge: 'App' };

type Call = { url: string; method: string; body?: unknown };

function stubServer(overrides: Record<string, () => Response> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const custom = overrides[url];
      if (custom) return custom();
      if (url === '/api/chats') return new Response(JSON.stringify({ chatId: 'chat-new' }), { status: 200 });
      if (url === '/api/workspaces/w1/apps/app-portal/chat') return new Response(JSON.stringify({ chatId: 'chat-app', botUserId: 'u-bot' }), { status: 200 });
      if (url === '/api/workspaces/w1/app-directory') return new Response(JSON.stringify({ apps: [{ appId: 'app-portal', clientId: 'c', name: 'Portal', features: [], commands: [], installation: { installationId: 'i', botUserId: 'u-bot', installedBy: null, installedAt: '2026-10-20T00:00:00.000Z', channels: 0, directs: 0 } }] }), { status: 200 });
      return new Response('{}', { status: 200 });
    })
  );
  return calls;
}

function Host(props: { person: CardPerson; spaceId?: string; onOpenChat: (chatId: string, known?: ChatSummary) => void }) {
  const card = usePersonCardWeb({ jwt: 'jwt', myUserId: 'u-me', spaceId: props.spaceId, onOpenChat: props.onOpenChat });
  return (
    <>
      <button type="button" data-testid="mostrar" onClick={() => card.show(props.person)} />
      {card.element}
    </>
  );
}

async function open(person: CardPerson, spaceId?: string) {
  const onOpenChat = vi.fn();
  render(<Host person={person} spaceId={spaceId} onOpenChat={onOpenChat} />);
  await userEvent.click(screen.getByTestId('mostrar'));
  return onOpenChat;
}

afterEach(() => vi.unstubAllGlobals());

describe('the person card of the web', () => {
  it('shows who they are: name, pill and phone', async () => {
    // Arrange
    stubServer();
    // Act
    await open(ana);
    // Assert
    expect(screen.getByTestId('persona-nombre')).toHaveTextContent('Ana');
    expect(screen.getByTestId('persona-insignia')).toHaveTextContent('Capataz');
    expect(screen.getByTestId('persona-telefono')).toBeInTheDocument();
  });

  it('in a personal chat «Enviar mensaje» opens the plain 1:1', async () => {
    // Arrange
    const calls = stubServer();
    const onOpenChat = await open(ana);
    // Act
    await userEvent.click(screen.getByTestId('persona-enviar-mensaje'));
    // Assert
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledTimes(1));
    expect(calls).toContainEqual({ url: '/api/chats', method: 'POST', body: { kind: 'direct', memberIds: ['u-ana'] } });
    expect(onOpenChat).toHaveBeenCalledWith('chat-new', undefined);
    expect(screen.queryByTestId('persona-nombre')).toBeNull();
  });

  it('in a space it opens the 1:1 of THAT space, with the summary in hand', async () => {
    // Arrange
    const calls = stubServer();
    const onOpenChat = await open(ana, 'w1');
    // Act
    await userEvent.click(screen.getByTestId('persona-enviar-mensaje'));
    // Assert
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledTimes(1));
    expect(calls).toContainEqual({ url: '/api/chats', method: 'POST', body: { kind: 'direct', memberIds: ['u-ana'], workspaceId: 'w1' } });
    expect(onOpenChat).toHaveBeenCalledWith('chat-new', expect.objectContaining({ id: 'chat-new', kind: 'direct', name: 'Ana', workspaceId: 'w1', memberIds: ['u-me', 'u-ana'] }));
  });

  it('an installed app goes through its own 1:1, with its head', async () => {
    // Arrange
    const calls = stubServer();
    const onOpenChat = await open(bot, 'w1');
    // Act
    await userEvent.click(await screen.findByTestId('persona-enviar-mensaje'));
    // Assert
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledTimes(1));
    expect(calls).toContainEqual({ url: '/api/workspaces/w1/apps/app-portal/chat', method: 'POST', body: {} });
    expect(onOpenChat).toHaveBeenCalledWith('chat-app', expect.objectContaining({ id: 'chat-app', workspaceId: 'w1', appId: 'app-portal', name: 'Portal' }));
  });

  it('a bot that is not installed in the space is not offered', async () => {
    // Arrange
    stubServer({ '/api/workspaces/w1/app-directory': () => new Response(JSON.stringify({ apps: [] }), { status: 200 }) });
    // Act
    await open(bot, 'w1');
    // Assert
    await waitFor(() => expect(screen.getByTestId('persona-nombre')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('persona-verificando')).toBeNull());
    expect(screen.queryByTestId('persona-enviar-mensaje')).toBeNull();
  });

  it('a failure stays on the card, under the button, and lets them retry', async () => {
    // Arrange
    stubServer({ '/api/chats': () => new Response(JSON.stringify({ message: 'No eres miembro de este espacio.' }), { status: 403 }) });
    const onOpenChat = await open(ana, 'w1');
    // Act
    await userEvent.click(screen.getByTestId('persona-enviar-mensaje'));
    // Assert
    expect(await screen.findByTestId('persona-error')).toHaveTextContent('No eres miembro de este espacio.');
    expect(onOpenChat).not.toHaveBeenCalled();
    expect(screen.getByTestId('persona-enviar-mensaje')).toBeEnabled();
  });

  it('the card closes with its button', async () => {
    // Arrange
    stubServer();
    await open(ana);
    // Act
    await userEvent.click(screen.getByTestId('btn-cerrar-overlay'));
    // Assert
    expect(screen.queryByTestId('persona-nombre')).toBeNull();
  });
});
