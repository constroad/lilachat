import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useConfirm, type ConfirmRequest } from './useConfirm';

afterEach(cleanup);

const REQUEST: ConfirmRequest = { title: '¿Quitar :fuego:?', text: 'Sale del espacio.', confirmLabel: 'Quitar' };

/** Renders a button that asks, and keeps what the person answered. */
function mount() {
  const answers: boolean[] = [];
  function Asker() {
    const confirm = useConfirm();
    return (
      <>
        <button type="button" data-testid="preguntar" onClick={() => void confirm.ask(REQUEST).then((yes) => answers.push(yes))}>preguntar</button>
        {confirm.dialog}
      </>
    );
  }
  const view = render(<Asker />);
  return { answers, view };
}

/** José 27/11: every `window.confirm` of the web becomes the app's own dialog. */
describe('useConfirm', () => {
  it('shows nothing until it asks, then resolves true on confirm', async () => {
    // Arrange
    const { answers } = mount();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Act
    fireEvent.click(screen.getByTestId('preguntar'));
    await act(async () => fireEvent.click(screen.getByTestId('btn-confirmar')));
    // Assert
    expect(answers).toEqual([true]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancelling resolves false', async () => {
    const { answers } = mount();
    fireEvent.click(screen.getByTestId('preguntar'));
    expect(screen.getByRole('alertdialog').textContent).toContain('Sale del espacio.');
    await act(async () => fireEvent.click(screen.getByTestId('btn-cancelar-confirmacion')));
    expect(answers).toEqual([false]);
  });

  it('a screen that goes away while asking answers false, never leaves the caller waiting', async () => {
    const { answers, view } = mount();
    fireEvent.click(screen.getByTestId('preguntar'));
    await act(async () => view.unmount());
    expect(answers).toEqual([false]);
  });
});
