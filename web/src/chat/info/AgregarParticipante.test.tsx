import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aDetalle } from '../useDetalleDelChat';
import type { ChatSummary } from '../types';
import { PanelDeInfo } from './PanelDeInfo';

/**
 * José, 25/10/2026: in a private channel of the space «Constroad», «Agregar miembros»
 * did not list Max, who is in the space (he signed up with a phone, no email, and had
 * never talked to the person adding him). The picker listed contacts; inside a space the
 * candidates are the space's active members that are not in the channel yet.
 */
const channel: ChatSummary = {
  id: 'c1',
  kind: 'group',
  name: 'privado',
  workspaceId: 'w1',
  memberIds: ['u-jc'],
  lastSeq: 1,
  unread: 0,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
};
const detail = aDetalle({ members: [{ id: 'u-jc', name: 'Juan Carlos', phone: '900000001', role: 'admin', esYo: true }] });

const spaceMembers = [
  { id: 'm1', userId: 'u-jc', name: 'Juan Carlos', phone: '900000001', role: 'owner', status: 'active' },
  { id: 'm2', userId: 'u-max', name: 'Max', phone: '987000111', role: 'member', status: 'active' },
  { id: 'm3', userId: 'u-ana', name: 'Ana', phone: '999111222', role: 'member', status: 'active' },
  { id: 'm4', userId: 'u-pend', name: 'Pendiente', phone: '911000001', role: 'member', status: 'pending' },
];

function stubServer() {
  const calls: { url: string; method: string; body?: string }[] = [];
  const server = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    if (url.startsWith('/api/workspaces/w1/members')) return new Response(JSON.stringify({ members: spaceMembers }), { status: 200 });
    if (url === '/api/contacts') return new Response(JSON.stringify({ groups: [] }), { status: 200 });
    return new Response('{"ok":true}', { status: 200 });
  });
  vi.stubGlobal('fetch', server);
  return calls;
}

function open(chat: ChatSummary = channel) {
  render(<PanelDeInfo chat={chat} detalle={detail} yo="u-jc" jwt="jwt" base={null} onCerrar={vi.fn()} onAviso={vi.fn()} onCambio={vi.fn()} onAccionDeChat={vi.fn()} onLevel={vi.fn()} onVerFoto={vi.fn()} />);
}

afterEach(() => vi.unstubAllGlobals());

describe('Agregar miembros in a channel of a space', () => {
  it('lists the active members of the space that are not in the channel, even with no chat open with them', async () => {
    // Arrange
    const calls = stubServer();
    open();
    // Act
    await userEvent.click(screen.getByTestId('btn-agregar-participante'));
    // Assert
    expect(await screen.findByTestId('contacto-u-max')).toBeInTheDocument();
    expect(screen.getByTestId('contacto-u-ana')).toBeInTheDocument();
    expect(screen.queryByTestId('contacto-u-jc')).toBeNull();
    expect(screen.queryByTestId('contacto-u-pend')).toBeNull();
    expect(calls.some((call) => call.url === '/api/contacts')).toBe(false);
  });

  it('searches by name and adds the chosen one to the channel', async () => {
    // Arrange
    const calls = stubServer();
    open();
    await userEvent.click(screen.getByTestId('btn-agregar-participante'));
    await screen.findByTestId('contacto-u-max');
    // Act
    await userEvent.type(screen.getByTestId('buscar-contactos'), 'max');
    expect(screen.queryByTestId('contacto-u-ana')).toBeNull();
    await userEvent.click(screen.getByTestId('contacto-u-max'));
    expect(screen.getByText('¿Max puede ver el historial?')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('historial-todo'));
    // Assert
    await waitFor(() => expect(calls).toContainEqual({ url: '/api/chats/c1/members', method: 'POST', body: JSON.stringify({ userId: 'u-max', history: true }) }));
  });

  it('«No, solo desde ahora» adds them without the earlier messages (José 30/10)', async () => {
    const calls = stubServer();
    open();
    await userEvent.click(screen.getByTestId('btn-agregar-participante'));
    await userEvent.click(await screen.findByTestId('contacto-u-ana'));
    await userEvent.click(screen.getByTestId('historial-desde-ahora'));
    await waitFor(() => expect(calls).toContainEqual({ url: '/api/chats/c1/members', method: 'POST', body: JSON.stringify({ userId: 'u-ana', history: false }) }));
  });

  it('a chat with no messages yet adds without asking', async () => {
    const calls = stubServer();
    open({ ...channel, lastSeq: 0 });
    await userEvent.click(screen.getByTestId('btn-agregar-participante'));
    await userEvent.click(await screen.findByTestId('contacto-u-ana'));
    expect(screen.queryByTestId('historial-todo')).toBeNull();
    await waitFor(() => expect(calls).toContainEqual({ url: '/api/chats/c1/members', method: 'POST', body: JSON.stringify({ userId: 'u-ana' }) }));
  });

  it('a group outside any space keeps listing the contacts', async () => {
    // Arrange
    const calls = stubServer();
    open({ ...channel, workspaceId: undefined });
    // Act
    await userEvent.click(screen.getByTestId('btn-agregar-participante'));
    // Assert
    await waitFor(() => expect(calls.some((call) => call.url === '/api/contacts')).toBe(true));
    expect(calls.some((call) => call.url.startsWith('/api/workspaces/'))).toBe(false);
  });
});
