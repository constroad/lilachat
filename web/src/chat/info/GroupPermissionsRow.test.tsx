import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupPermissionsRow } from './GroupPermissionsRow';

/** «Permisos del grupo» (pending 8): admins switch what the members may do. */
afterEach(() => vi.unstubAllGlobals());

describe('GroupPermissionsRow', () => {
  it('starts from the defaults and an admin closes «enviar mensajes» with one switch', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<GroupPermissionsRow chatId="g1" jwt="jwt" permissions={undefined} isAdmin onAviso={() => undefined} />);
    expect(screen.getByTestId('interruptor-permiso-sendMessages')).toBeChecked();
    expect(screen.getByTestId('interruptor-permiso-pinMessages')).not.toBeChecked();
    // Act
    fireEvent.click(screen.getByTestId('interruptor-permiso-sendMessages'));
    // Assert
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chats/g1/permissions', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ sendMessages: false }) })));
    expect(screen.getByTestId('interruptor-permiso-sendMessages')).not.toBeChecked();
  });

  it('a refusal puts the switch back and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Solo los admins cambian los permisos.' }), { status: 403 })));
    const onAviso = vi.fn();
    render(<GroupPermissionsRow chatId="g1" jwt="jwt" permissions={{ pinMessages: false }} isAdmin onAviso={onAviso} />);
    fireEvent.click(screen.getByTestId('interruptor-permiso-pinMessages'));
    await vi.waitFor(() => expect(onAviso).toHaveBeenCalledWith('Solo los admins cambian los permisos.'));
    expect(screen.getByTestId('interruptor-permiso-pinMessages')).not.toBeChecked();
  });

  it('a member sees the rules but cannot move them', () => {
    render(<GroupPermissionsRow chatId="g1" jwt="jwt" permissions={{ sendMessages: false }} isAdmin={false} onAviso={() => undefined} />);
    expect(screen.getByTestId('interruptor-permiso-sendMessages')).toBeDisabled();
    expect(screen.getByTestId('interruptor-permiso-sendMessages')).not.toBeChecked();
    expect(screen.getByText(/Solo los admins pueden cambiarlo/)).toBeInTheDocument();
  });
});
