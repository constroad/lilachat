import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteChannelRow } from './DeleteChannelRow';

/** «Eliminar canal» (José 30/10: there was no way to delete one): space admins only, never #general. */
afterEach(() => vi.unstubAllGlobals());

const base = { chatId: 'c1', workspaceId: 'w1', name: 'obra-norte', jwt: 'jwt', onNotice: () => undefined };

describe('DeleteChannelRow', () => {
  it('asks first, then deletes the channel for everyone and closes it', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onDeleted = vi.fn();
    const onNotice = vi.fn();
    render(<DeleteChannelRow {...base} canDelete onNotice={onNotice} onDeleted={onDeleted} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-eliminar-canal'));
    expect(screen.getByText('¿Eliminar #obra-norte?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-confirmar-eliminar-canal'));
    // Assert
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/workspaces/w1/channels/c1', expect.objectContaining({ method: 'DELETE' }));
    expect(onNotice).toHaveBeenCalledWith('Canal eliminado');
  });

  it('cancelling sends nothing', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<DeleteChannelRow {...base} canDelete onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByTestId('btn-eliminar-canal'));
    fireEvent.click(screen.getByText('Cancelar'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Eliminar #obra-norte?')).not.toBeInTheDocument();
  });

  it('a refusal says why and keeps the channel open', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'El canal general no se elimina.' }), { status: 400 })));
    const onDeleted = vi.fn();
    const onNotice = vi.fn();
    render(<DeleteChannelRow {...base} canDelete onNotice={onNotice} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByTestId('btn-eliminar-canal'));
    fireEvent.click(screen.getByTestId('btn-confirmar-eliminar-canal'));
    await vi.waitFor(() => expect(onNotice).toHaveBeenCalledWith('El canal general no se elimina.'));
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('whoever cannot delete does not see the row', () => {
    render(<DeleteChannelRow {...base} canDelete={false} onDeleted={vi.fn()} />);
    expect(screen.queryByTestId('btn-eliminar-canal')).not.toBeInTheDocument();
  });
});
