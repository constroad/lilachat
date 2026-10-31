import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoticePreviewChoice } from './NoticePreviewChoice';

/** «Vista previa en los avisos» in the settings panel (R31/10-B8). */
describe('NoticePreviewChoice', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads its own setting and turns it off', async () => {
    // Arrange
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'PUT' ? JSON.parse(String(init.body)) : { on: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<NoticePreviewChoice jwt="t" onNotice={vi.fn()} />);
    const toggle = screen.getByTestId('interruptor-vista-previa') as HTMLInputElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
    // Act
    fireEvent.click(toggle);
    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/me/notification-preview', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ on: false }) })));
    expect(fetchMock).toHaveBeenCalledWith('/api/me/notification-preview', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer t' }) }));
  });
});
