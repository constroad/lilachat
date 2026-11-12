import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ClientWorkspace } from '@lilachat/shared';
import { InviteToSpaceDialog } from './InviteToSpaceDialog';
import { inviteToSpaceByEmail } from './spacesApi';

/** José 12/11: «¿por qué me abre el email de la Mac?». Lilachat sends the invitation; nobody writes it. */
vi.mock('./spacesApi', () => ({ addToSpace: vi.fn(), inviteToSpaceByEmail: vi.fn() }));

const space = { id: 's1', name: 'Test', joinCode: 'TEST-7K3P' } as ClientWorkspace;
const invite = (email: string) => {
  fireEvent.change(screen.getByTestId('input-correo-espacio'), { target: { value: email } });
  fireEvent.click(screen.getByTestId('btn-invitar-correo'));
};

afterEach(() => {
  cleanup();
  vi.mocked(inviteToSpaceByEmail).mockReset();
});

describe('InviteToSpaceDialog, by email', () => {
  it('the server sends the email: the row says so and no mail app opens', async () => {
    // Arrange
    vi.mocked(inviteToSpaceByEmail).mockResolvedValue({ ok: true, data: { id: 'i1', email: 'luis@empresa.pe', status: 'invited', emailSent: true } });
    const before = window.location.href;
    render(<InviteToSpaceDialog space={space} jwt="jwt" onClose={vi.fn()} />);
    // Act
    invite('Luis@Empresa.pe');
    // Assert
    expect(await screen.findByText('CORREO ENVIADO')).toBeInTheDocument();
    expect(window.location.href).toBe(before);
    expect(screen.getByText(/Lilachat le envía un correo/)).toBeInTheDocument();
    expect(screen.queryByText(/se abre tu correo/)).toBeNull();
  });

  it('a refused email shows why and «Reenviar» sends it again', async () => {
    // Arrange
    vi.mocked(inviteToSpaceByEmail)
      .mockResolvedValueOnce({ ok: true, data: { id: 'i1', email: 'luis@empresa.pe', status: 'invited', emailSent: false, emailError: 'La invitación quedó guardada, pero el correo no salió. Toca Reenviar.' } })
      .mockResolvedValueOnce({ ok: true, data: { id: 'i1', email: 'luis@empresa.pe', status: 'invited', emailSent: true } });
    render(<InviteToSpaceDialog space={space} jwt="jwt" onClose={vi.fn()} />);
    invite('luis@empresa.pe');
    expect(await screen.findByText('SIN ENVIAR')).toBeInTheDocument();
    expect(screen.getByText('La invitación quedó guardada, pero el correo no salió. Toca Reenviar.')).toBeInTheDocument();
    // Act
    fireEvent.click(screen.getByTestId('reenviar-correo-luis@empresa.pe'));
    // Assert
    expect(await screen.findByText('CORREO ENVIADO')).toBeInTheDocument();
    expect(inviteToSpaceByEmail).toHaveBeenLastCalledWith('jwt', 's1', 'luis@empresa.pe');
    expect(screen.queryByTestId('reenviar-correo-luis@empresa.pe')).toBeNull();
  });

  it('someone already in the space is «AGREGADO», with nothing to resend', async () => {
    vi.mocked(inviteToSpaceByEmail).mockResolvedValue({ ok: true, data: { id: 'm1', email: 'ana@empresa.pe', status: 'active' } });
    render(<InviteToSpaceDialog space={space} jwt="jwt" onClose={vi.fn()} />);
    invite('ana@empresa.pe');
    expect(await screen.findByText('AGREGADO')).toBeInTheDocument();
    expect(screen.queryByTestId('reenviar-correo-ana@empresa.pe')).toBeNull();
  });
});
