import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UndoProgress } from './PendingProgress';

/** José 28/11: no approval; «Deshacer» takes a record back after asking once. */
describe('«Deshacer» a record', () => {
  it('asks first, then undoes; Portal\'s refusal is shown', async () => {
    // Arrange
    const onUndo = vi.fn(async () => 'No es tuyo.');
    render(<UndoProgress id="a1" toM={30} onUndo={onUndo} />);
    // Act
    fireEvent.click(screen.getByTestId('deshacer-avance-a1'));
    // Assert
    expect(screen.getByText('¿Deshacer el avance hasta 0+030? Deja de sumar al avance de la obra.')).toBeInTheDocument();
    expect(onUndo).not.toHaveBeenCalled();
    // Act
    fireEvent.click(screen.getByTestId('deshacer-si-a1'));
    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No es tuyo.'));
    expect(onUndo).toHaveBeenCalledWith('a1');
  });

  it('closes the question once it is undone', async () => {
    // Arrange
    const onUndo = vi.fn(async () => null);
    render(<UndoProgress id="a1" toM={30} onUndo={onUndo} />);
    // Act
    fireEvent.click(screen.getByTestId('deshacer-avance-a1'));
    fireEvent.click(screen.getByTestId('deshacer-si-a1'));
    // Assert
    await waitFor(() => expect(screen.getByTestId('deshacer-avance-a1')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
