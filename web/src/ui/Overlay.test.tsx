import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Overlay } from './Overlay';

/**
 * E2E 12/11 at phone width: «Editar» on an expense in a thread opened the form behind the
 * thread. Both were `fixed z-30`, and the thread came later in the page, so it won. The modal
 * now lives at the end of the body, above any panel that opened it.
 */
describe('Overlay', () => {
  it('opens at the end of the body, outside the panel that opened it', () => {
    // Arrange
    const { container } = render(
      <div data-testid="panel-conversacion">
        <Overlay title="Editar gasto" onClose={vi.fn()}>
          <p>Monto</p>
        </Overlay>
      </div>,
    );
    // Act
    const dialog = screen.getByRole('dialog', { name: 'Editar gasto' });
    // Assert
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.lastElementChild?.contains(dialog)).toBe(true);
  });

  it('still closes with Escape, the X and a click on the backdrop', () => {
    // Arrange
    const onClose = vi.fn();
    render(<Overlay title="Editar gasto" onClose={onClose}><p>Monto</p></Overlay>);
    // Act
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('btn-cerrar-overlay'));
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    fireEvent.click(screen.getByText('Monto'));
    // Assert
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
