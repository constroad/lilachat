import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortalFileViewer } from './PortalFileViewer';

/**
 * 31/10: Portal and lila send their PDFs SAMEORIGIN, so a frame of their URL is
 * refused. The viewer fetches the file and shows it from memory; a quote's PDF
 * answers 202 while it is generated, and the viewer asks again.
 */
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf-1'), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const pdf = { url: 'https://www.constroad.com/api/public/quote-pdf/q1?token=t', name: 'Cotización 101 · PDF', mime: 'application/pdf' };
const answer = (status: number, headers: Record<string, string> = {}) => new Response(status === 200 ? new Blob(['%PDF-1.7']) : '{}', { status, headers });

function Harness() {
  const viewer = usePortalFileViewer();
  return (
    <>
      <button type="button" onClick={() => viewer.open(pdf)}>abrir</button>
      {viewer.viewer}
    </>
  );
}

describe('the Portal PDF viewer on the web', () => {
  it('while Portal generates it says so, asks again as Retry-After says, and shows it from memory', async () => {
    // Arrange
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(answer(202, { 'Retry-After': '5' })).mockResolvedValueOnce(answer(200));
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness />);
    // Act
    fireEvent.click(screen.getByText('abrir'));
    await act(async () => undefined);
    const waiting = screen.getByTestId('pdf-preparando').textContent;
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    // Assert
    expect(waiting).toContain('Preparando el PDF');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('pdf-visor')).toHaveAttribute('src', 'blob:pdf-1');
  });

  it('a quote without a document says it, without an empty frame', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(409)));
    render(<Harness />);
    fireEvent.click(screen.getByText('abrir'));
    expect(await screen.findByTestId('pdf-no-disponible')).toHaveTextContent('todavía no se generó');
    expect(screen.queryByTestId('pdf-visor')).toBeNull();
  });

  it('a file that cannot be fetched from here says so and keeps «Abrir en otra pestaña»', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<Harness />);
    fireEvent.click(screen.getByText('abrir'));
    expect(await screen.findByTestId('pdf-no-disponible')).toHaveTextContent('otra pestaña');
    expect(screen.queryByTestId('pdf-visor')).toBeNull();
  });
});
