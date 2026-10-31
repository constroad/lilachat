import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLock, LOCK_NOW_EVENT, readLock, saveLock } from './screenLock';
import { ScreenLockGate } from './ScreenLockGate';
import { ScreenLockChoice } from './ScreenLockChoice';

/** The web's screen lock (R31/10, like WhatsApp Web). */
describe('ScreenLockGate', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('without a lock it shows nothing', () => {
    render(<ScreenLockGate userId="jose" onForgot={vi.fn()} />);
    expect(screen.queryByTestId('pantalla-bloqueada')).not.toBeInTheDocument();
  });

  it('with a lock it opens locked; a wrong password says so and the right one opens it', async () => {
    // Arrange
    saveLock('jose', await createLock('obra2026', 15));
    render(<ScreenLockGate userId="jose" onForgot={vi.fn()} />);
    // Act
    fireEvent.change(screen.getByTestId('input-clave-bloqueo'), { target: { value: 'otra-clave' } });
    fireEvent.click(screen.getByTestId('btn-desbloquear'));
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña incorrecta.');
    fireEvent.change(screen.getByTestId('input-clave-bloqueo'), { target: { value: 'obra2026' } });
    fireEvent.click(screen.getByTestId('btn-desbloquear'));
    await waitFor(() => expect(screen.queryByTestId('pantalla-bloqueada')).not.toBeInTheDocument());
  });

  it('«Olvidé la contraseña» removes the lock and closes the session', async () => {
    // Arrange
    saveLock('jose', await createLock('obra2026', 15));
    const onForgot = vi.fn();
    render(<ScreenLockGate userId="jose" onForgot={onForgot} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-olvide-clave'));
    // Assert
    expect(onForgot).toHaveBeenCalled();
    expect(readLock('jose')).toBeNull();
  });

  it('«Bloquear ahora» locks at once', async () => {
    // Arrange: set the lock after the gate is up, as from the settings panel
    render(<ScreenLockGate userId="jose" onForgot={vi.fn()} />);
    const lock = await createLock('obra2026', 60);
    act(() => saveLock('jose', lock));
    expect(screen.queryByTestId('pantalla-bloqueada')).not.toBeInTheDocument();
    // Act
    act(() => { window.dispatchEvent(new Event(LOCK_NOW_EVENT)); });
    // Assert
    expect(screen.getByTestId('pantalla-bloqueada')).toBeInTheDocument();
  });

  it('locks after the chosen minutes without activity', async () => {
    // Arrange
    const lock = await createLock('obra2026', 1);
    vi.useFakeTimers();
    render(<ScreenLockGate userId="jose" onForgot={vi.fn()} />);
    act(() => saveLock('jose', lock));
    // Act
    act(() => { vi.advanceTimersByTime(61_000); });
    // Assert
    expect(screen.getByTestId('pantalla-bloqueada')).toBeInTheDocument();
  });
});

describe('ScreenLockChoice', () => {
  beforeEach(() => localStorage.clear());

  it('turning it on asks the password twice and keeps only its hash', async () => {
    // Arrange
    render(<ScreenLockChoice userId="jose" />);
    fireEvent.click(screen.getByTestId('btn-bloqueo-pantalla'));
    // Act
    fireEvent.change(screen.getByTestId('input-clave-nueva'), { target: { value: 'obra2026' } });
    fireEvent.change(screen.getByTestId('input-clave-repetida'), { target: { value: 'obra2025' } });
    fireEvent.click(screen.getByTestId('btn-activar-bloqueo'));
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.');
    fireEvent.change(screen.getByTestId('input-clave-repetida'), { target: { value: 'obra2026' } });
    fireEvent.click(screen.getByTestId('btn-activar-bloqueo'));
    await waitFor(() => expect(readLock('jose')?.afterMinutes).toBe(15));
    expect(localStorage.getItem('lilachat.screenLock.jose')).not.toContain('obra2026');
  });

  it('turning it off needs the current password', async () => {
    // Arrange
    saveLock('jose', await createLock('obra2026', 15));
    render(<ScreenLockChoice userId="jose" />);
    fireEvent.click(screen.getByTestId('btn-bloqueo-pantalla'));
    // Act
    fireEvent.change(screen.getByTestId('input-clave-desactivar'), { target: { value: 'nope-nope' } });
    fireEvent.click(screen.getByTestId('btn-desactivar-bloqueo'));
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña incorrecta.');
    fireEvent.change(screen.getByTestId('input-clave-desactivar'), { target: { value: 'obra2026' } });
    fireEvent.click(screen.getByTestId('btn-desactivar-bloqueo'));
    await waitFor(() => expect(readLock('jose')).toBeNull());
  });
});
