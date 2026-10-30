import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockContactRow } from './BlockContactRow';
import { BlockedContactsChoice } from './BlockedContactsChoice';

/** Pending 9: blocking from a 1:1's info, and the list in the settings panel. */
afterEach(() => vi.unstubAllGlobals());

describe('BlockContactRow', () => {
  it('blocking asks first; cancelling sends nothing', () => {
    // Arrange
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<BlockContactRow jwt="jwt" personId="u2" name="Ana" blockedByMe={false} onNotice={() => undefined} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-bloquear-contacto'));
    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confirmed, it blocks and offers to unblock; unblocking needs no question', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', confirmMock);
    render(<BlockContactRow jwt="jwt" personId="u2" name="Ana" blockedByMe={false} onNotice={() => undefined} />);
    fireEvent.click(screen.getByTestId('btn-bloquear-contacto'));
    await screen.findByText('Desbloquear a Ana');
    expect(fetchMock).toHaveBeenCalledWith('/api/me/blocked', expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: 'u2' }) }));
    fireEvent.click(screen.getByTestId('btn-bloquear-contacto'));
    await screen.findByText('Bloquear a Ana');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/me/blocked/u2', expect.objectContaining({ method: 'DELETE' }));
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it('a refusal keeps the state and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'No encontramos a esa persona.' }), { status: 404 })));
    vi.stubGlobal('confirm', vi.fn(() => true));
    const onNotice = vi.fn();
    render(<BlockContactRow jwt="jwt" personId="u2" name="Ana" blockedByMe={false} onNotice={onNotice} />);
    fireEvent.click(screen.getByTestId('btn-bloquear-contacto'));
    await vi.waitFor(() => expect(onNotice).toHaveBeenCalledWith('No encontramos a esa persona.'));
    expect(screen.getByText('Bloquear a Ana')).toBeInTheDocument();
  });
});

describe('BlockedContactsChoice', () => {
  it('lists who I blocked and unblocks one in place', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? new Response(JSON.stringify({ ok: true }), { status: 200 }) : new Response(JSON.stringify({ blocked: [{ id: 'u2', name: 'Ana', phone: '987654321', avatarUrl: null }] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<BlockedContactsChoice jwt="jwt" onNotice={() => undefined} />);
    fireEvent.click(screen.getByTestId('btn-contactos-bloqueados'));
    fireEvent.click(await screen.findByTestId('btn-desbloquear-u2'));
    await screen.findByText('No bloqueaste a nadie.');
  });

  it('a failed read says so instead of an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    render(<BlockedContactsChoice jwt="jwt" onNotice={() => undefined} />);
    fireEvent.click(screen.getByTestId('btn-contactos-bloqueados'));
    await screen.findByText('No se pudo cargar.');
  });
});
