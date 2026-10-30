import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewPermissionsNotice } from './NewPermissionsNotice';

const api = vi.hoisted(() => ({ acceptAppScopes: vi.fn() }));
vi.mock('../spacesApi', () => api);

const lines = ['Leer los mensajes de los canales y grupos donde está, aunque no la mencionen'];
beforeEach(() => api.acceptAppScopes.mockReset());

describe('«Esta app pide permisos nuevos» (José, 30/10: aceptar sin reinstalar)', () => {
  it('an admin accepts them with one tap and the notice says so', async () => {
    // Arrange
    api.acceptAppScopes.mockResolvedValue({ ok: true, data: { grantedScopes: ['channels:history'] } });
    render(<NewPermissionsNotice jwt="jwt" spaceId="s1" appId="a1" lines={lines} admin />);
    // Act
    fireEvent.click(screen.getByTestId('app-aceptar-permisos'));
    // Assert
    expect(await screen.findByTestId('app-permisos-aceptados')).toHaveTextContent('Permisos aceptados');
    expect(api.acceptAppScopes).toHaveBeenCalledWith('jwt', 's1', 'a1');
  });

  it('a failure keeps the button and says why; a plain member only reads who accepts them', async () => {
    api.acceptAppScopes.mockResolvedValue({ ok: false, status: 403, message: 'Solo el dueño o un admin acepta los permisos de una app.' });
    const { unmount } = render(<NewPermissionsNotice jwt="jwt" spaceId="s1" appId="a1" lines={lines} admin />);
    fireEvent.click(screen.getByTestId('app-aceptar-permisos'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el dueño o un admin acepta los permisos de una app.');
    expect(screen.getByTestId('app-aceptar-permisos')).toBeEnabled();
    unmount();
    render(<NewPermissionsNotice jwt="jwt" spaceId="s1" appId="a1" lines={lines} admin={false} />);
    expect(screen.queryByTestId('app-aceptar-permisos')).toBeNull();
    expect(screen.getByTestId('app-permisos-nuevos')).toHaveTextContent('Un admin del espacio los acepta.');
  });
});
