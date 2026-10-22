import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDismiss } from './useDismiss';

function Panel({ onClose, open = true }: { onClose: () => void; open?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, onClose, { ignore: '[data-toggle]' });
  return (
    <div>
      <button type="button" data-toggle>abrir</button>
      <div ref={ref} data-testid="panel"><button type="button">adentro</button></div>
      <button type="button">afuera</button>
      <div role="dialog"><button type="button">en un diálogo</button></div>
    </div>
  );
}

/** José, 21/10: «en la web muchas ventanas se abren pero no se cierran». */
describe('useDismiss', () => {
  it('a click outside or Escape closes it', () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    fireEvent.mouseDown(screen.getByText('afuera'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('a click inside, on its own toggle or in a dialog it opened does not', () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    fireEvent.mouseDown(screen.getByText('adentro'));
    fireEvent.mouseDown(screen.getByText('abrir'));
    fireEvent.mouseDown(screen.getByText('en un diálogo'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a menu inside a dialog closes on a click elsewhere in that dialog', () => {
    const onClose = vi.fn();
    function MenuInDialog() {
      const ref = useRef<HTMLDivElement>(null);
      useDismiss(true, ref, onClose);
      return (
        <div role="dialog">
          <div ref={ref}>menú</div>
          <button type="button">al lado</button>
        </div>
      );
    }
    render(<MenuInDialog />);
    fireEvent.mouseDown(screen.getByText('al lado'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closed, it listens to nothing', () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} open={false} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
