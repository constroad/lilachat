import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { askMuteDuration, MuteDialogHost } from './MuteDialog';

/** «Silenciar notificaciones: 8 horas · 1 semana · Siempre» (R31/10). */
describe('askMuteDuration', () => {
  it('asks in the dialog and answers the chosen duration', async () => {
    // Arrange
    render(<MuteDialogHost />);
    let answer: Promise<unknown> = Promise.resolve();
    act(() => { answer = askMuteDuration(); });
    // Act
    fireEvent.click(screen.getByTestId('silenciar-1w'));
    fireEvent.click(screen.getByTestId('confirmar-silenciar'));
    // Assert
    await expect(answer).resolves.toBe('1w');
    expect(screen.queryByText('Silenciar notificaciones')).not.toBeInTheDocument();
  });

  it('8 horas is the first choice, and cancelling mutes nothing', async () => {
    // Arrange
    render(<MuteDialogHost />);
    let answer: Promise<unknown> = Promise.resolve();
    act(() => { answer = askMuteDuration(); });
    // Act
    const eightHours = screen.getByTestId('silenciar-8h') as HTMLInputElement;
    fireEvent.click(screen.getByText('Cancelar'));
    // Assert
    expect(eightHours.checked).toBe(true);
    await expect(answer).resolves.toBeNull();
  });

  it('without the dialog mounted it mutes as before: siempre', async () => {
    await expect(askMuteDuration()).resolves.toBe('always');
  });
});
