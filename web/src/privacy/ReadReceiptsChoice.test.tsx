import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadReceiptsChoice } from './ReadReceiptsChoice';

/** «Confirmaciones de lectura» in the settings panel (R31/10). */
describe('ReadReceiptsChoice', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows what the server keeps and saves the change', async () => {
    // Arrange
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'PUT' ? JSON.parse(String(init.body)) : { on: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReadReceiptsChoice jwt="t" onNotice={vi.fn()} />);
    const toggle = screen.getByTestId('interruptor-confirmaciones-lectura') as HTMLInputElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
    // Act
    fireEvent.click(toggle);
    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/me/read-receipts', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ on: false }) })));
    expect(toggle.checked).toBe(false);
  });

  it('a save that fails goes back and says so', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'PUT' ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ on: true }), { status: 200 }))));
    const onNotice = vi.fn();
    render(<ReadReceiptsChoice jwt="t" onNotice={onNotice} />);
    const toggle = screen.getByTestId('interruptor-confirmaciones-lectura') as HTMLInputElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
    // Act
    fireEvent.click(toggle);
    // Assert
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('No se pudo guardar. Revisa tu conexión.'));
    expect(toggle.checked).toBe(true);
  });
});
