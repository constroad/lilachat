import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppBoundary, PanelBoundary } from './ErrorBoundary';

function Broken(): never {
  throw new Error('panel exploded');
}

/** Backlog 4 (José, 20/10): closing a thread left the whole web blank. A failing piece now fails alone. */
describe('error boundaries', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('a failing panel shows its message and can be closed, the rest stays', () => {
    const onClose = vi.fn();
    render(
      <div>
        <p>El chat sigue aquí</p>
        <PanelBoundary label="el hilo" onClose={onClose}>
          <Broken />
        </PanelBoundary>
      </div>
    );

    expect(screen.getByText('El chat sigue aquí')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No se pudo mostrar el hilo.');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('logs the error so it can be read in the console', () => {
    render(
      <PanelBoundary label="el hilo" onClose={() => {}}>
        <Broken />
      </PanelBoundary>
    );

    expect(consoleError.mock.calls.some((call) => String(call[0]).includes('[lilachat] el hilo'))).toBe(true);
  });

  it('renders its children when nothing fails', () => {
    render(
      <PanelBoundary label="el hilo" onClose={() => {}}>
        <p>Hilo abierto</p>
      </PanelBoundary>
    );

    expect(screen.getByText('Hilo abierto')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the whole app never stays blank: it offers to reload', () => {
    render(
      <AppBoundary>
        <Broken />
      </AppBoundary>
    );

    expect(screen.getByRole('alert').textContent).toContain('Algo falló al mostrar Lilachat.');
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy();
  });
});
