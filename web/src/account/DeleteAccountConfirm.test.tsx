import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_DELETION_TEXTS } from '@lilachat/shared';
import { DeleteAccountConfirm } from './DeleteAccountConfirm';

/** «Borrar mi cuenta» (José 19/11): what goes, what stays, the 30 days, and the word typed. */
describe('DeleteAccountConfirm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explains what is erased, what stays and the grace before anything is asked', () => {
    // Arrange / Act
    render(<DeleteAccountConfirm jwt="t" onDeleted={vi.fn()} />);

    // Assert
    expect(screen.getByText(ACCOUNT_DELETION_TEXTS.kept)).toBeTruthy();
    expect(screen.getByText(ACCOUNT_DELETION_TEXTS.grace)).toBeTruthy();
    expect(screen.getByText(ACCOUNT_DELETION_TEXTS.erased[0])).toBeTruthy();
  });

  it('keeps the button off until BORRAR is typed', () => {
    // Arrange
    render(<DeleteAccountConfirm jwt="t" onDeleted={vi.fn()} />);
    const button = screen.getByTestId('btn-confirmar-borrar-cuenta') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Act
    fireEvent.change(screen.getByTestId('input-confirmar-borrar-cuenta'), { target: { value: 'borrar' } });

    // Assert
    expect(button.disabled).toBe(false);
  });

  it('asks the server with the word and hands back the deadline', async () => {
    // Arrange
    const deadline = '2026-12-19T15:00:00.000Z';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ requested: true, requestedAt: '2026-11-19T15:00:00.000Z', deadline }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onDeleted = vi.fn();
    render(<DeleteAccountConfirm jwt="t" onDeleted={onDeleted} />);
    fireEvent.change(screen.getByTestId('input-confirmar-borrar-cuenta'), { target: { value: 'BORRAR' } });

    // Act
    fireEvent.click(screen.getByTestId('btn-confirmar-borrar-cuenta'));

    // Assert
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(new Date(deadline)));
    expect(fetchMock).toHaveBeenCalledWith('/api/me/account-deletion', expect.objectContaining({ method: 'POST', body: JSON.stringify({ confirm: 'BORRAR' }) }));
  });

  it('shows the server refusal, such as a space left without anyone in charge', async () => {
    // Arrange
    const message = 'Estás a cargo del espacio «Constroad», que tiene otros miembros. Pasa el espacio a otra persona o elimínalo antes de borrar tu cuenta.';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message }), { status: 409 })));
    const onDeleted = vi.fn();
    render(<DeleteAccountConfirm jwt="t" onDeleted={onDeleted} />);
    fireEvent.change(screen.getByTestId('input-confirmar-borrar-cuenta'), { target: { value: 'BORRAR' } });

    // Act
    fireEvent.click(screen.getByTestId('btn-confirmar-borrar-cuenta'));

    // Assert
    await waitFor(() => expect(screen.getByTestId('error-borrar-cuenta').textContent).toBe(message));
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
