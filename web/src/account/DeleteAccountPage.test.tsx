import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_DELETION_TEXTS } from '@lilachat/shared';
import { DeleteAccountPage } from './DeleteAccountPage';

/** The public page Google Play links to (José 19/11): it explains first, then asks for the code. */
describe('DeleteAccountPage', () => {
  it('explains what goes, what stays and the 30 days without a session', () => {
    // Arrange / Act
    render(<DeleteAccountPage />);

    // Assert
    expect(screen.getByTestId('pagina-borrar-cuenta')).toBeTruthy();
    expect(screen.getByText(ACCOUNT_DELETION_TEXTS.kept)).toBeTruthy();
    expect(screen.getByText(ACCOUNT_DELETION_TEXTS.grace)).toBeTruthy();
  });

  it('continues to the sign-in by email, with the phone one tap away', () => {
    // Arrange
    render(<DeleteAccountPage />);

    // Act
    fireEvent.click(screen.getByTestId('btn-continuar-borrar'));

    // Assert
    expect(screen.getByTestId('input-correo')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn-entrar-telefono'));
    expect(screen.getByTestId('input-telefono')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn-atras-borrar'));
    expect(screen.getByTestId('input-correo')).toBeTruthy();
  });
});

describe('DeleteAccountChoice', () => {
  it('after asking from the settings, signs out and the page opens on «Tu cuenta se cerró»', async () => {
    // Arrange
    const { DeleteAccountChoice } = await import('./DeleteAccountChoice');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ requested: true, deadline: '2026-12-19T15:00:00.000Z' }), { status: 200 })));
    const onSignOut = vi.fn();
    const goTo = vi.fn();
    render(<DeleteAccountChoice jwt="t" onSignOut={onSignOut} goTo={goTo} />);
    fireEvent.click(screen.getByTestId('btn-borrar-cuenta'));
    fireEvent.change(screen.getByTestId('input-confirmar-borrar-cuenta'), { target: { value: 'BORRAR' } });

    // Act
    fireEvent.click(screen.getByTestId('btn-confirmar-borrar-cuenta'));

    // Assert
    await waitFor(() => expect(goTo).toHaveBeenCalledWith('/borrar-cuenta'));
    expect(onSignOut).toHaveBeenCalled();
    cleanup();
    render(<DeleteAccountPage />);
    expect(screen.getByTestId('borrado-pedido').textContent).toContain('19 dic. 2026');
    vi.unstubAllGlobals();
  });
});
