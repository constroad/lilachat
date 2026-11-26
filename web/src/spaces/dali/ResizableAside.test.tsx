import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ResizableAside } from './ResizableAside';

const props = { storageKey: 'dali-lista-test', side: 'left' as const, defaultWidth: 380, minWidth: 280, maxWidth: 560, label: 'Mostrar la lista', testId: 'columna-lista' };

// jsdom has no PointerEvent: without one the events lose their `clientX`.
if (!('PointerEvent' in window)) Object.defineProperty(window, 'PointerEvent', { value: MouseEvent });

describe('ResizableAside', () => {
  beforeEach(() => localStorage.clear());

  it('a release right after the last move (one React batch) keeps the dragged width and does not crash', () => {
    render(<ResizableAside {...props}>lista</ResizableAside>);
    const handle = screen.getByRole('separator');
    handle.setPointerCapture = () => undefined;
    // José 26/11: dragging fast broke the whole web; the move's update ran after the release cleared the drag.
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 130, pointerId: 1 });
    act(() => {
      fireEvent.pointerMove(handle, { clientX: 160, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: 160, pointerId: 1 });
    });
    expect(screen.getByTestId('columna-lista').style.width).toBe('440px');
    expect(JSON.parse(localStorage.getItem('dali-lista-test') ?? 'null')).toEqual({ width: 440, folded: false });
  });

  it('the right column grows when dragged to the left, within its limits', () => {
    render(<ResizableAside {...props} side="right" storageKey="dali-ficha-test">ficha</ResizableAside>);
    const handle = screen.getByRole('separator');
    handle.setPointerCapture = () => undefined;
    act(() => {
      fireEvent.pointerDown(handle, { clientX: 500, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: 100, pointerId: 1 });
    });
    expect(screen.getByTestId('columna-lista').style.width).toBe('560px');
  });
});
