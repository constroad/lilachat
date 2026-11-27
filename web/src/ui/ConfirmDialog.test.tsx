import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

const open = (overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const props = { title: '¿Eliminar el recordatorio?', text: 'Deja de sonar para todos.', confirmLabel: 'Eliminar', onConfirm: vi.fn(), onCancel: vi.fn(), ...overrides };
  render(<ConfirmDialog {...props} />);
  return props;
};

/** José 27/11: the browser's confirm froze the tab; the app asks with its own dialog. */
describe('ConfirmDialog', () => {
  it('says what happens and confirms with its own button', () => {
    // Arrange
    const props = open();
    // Act
    fireEvent.click(screen.getByTestId('btn-confirmar'));
    // Assert
    expect(screen.getByRole('alertdialog').textContent).toContain('Deja de sonar para todos.');
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('«Cancelar» and the backdrop only close it', () => {
    const props = open();
    fireEvent.click(screen.getByTestId('btn-cancelar-confirmacion'));
    fireEvent.click(screen.getByTestId('fondo-confirmacion'));
    expect(props.onCancel).toHaveBeenCalledTimes(2);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('Escape closes the question, not the form under it', () => {
    // Arrange: the form below listens to Escape on the window too
    const formEscape = vi.fn();
    window.addEventListener('keydown', formEscape);
    const props = open();
    // Act
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    // Assert
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(formEscape).not.toHaveBeenCalled();
    window.removeEventListener('keydown', formEscape);
  });

  it('while it works the buttons wait, so a double click deletes once', () => {
    const props = open({ busy: true });
    fireEvent.click(screen.getByTestId('btn-confirmar'));
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn-confirmar').hasAttribute('disabled')).toBe(true);
  });
});
