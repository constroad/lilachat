import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePortalFileViewer } from './PortalFileViewer';

/** Portal 31/10: a quote's PDF answers 202 while it is generated; the viewer asks again before showing it. */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const pdf = { url: 'https://www.constroad.com/api/public/quote-pdf/q1?token=t', name: 'Cotización 101 · PDF', mime: 'application/pdf' };
const answer = (status: number, headers: Record<string, string> = {}) => new Response(status === 206 ? 'x' : '{}', { status, headers });

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
  it('while Portal generates it says so, asks again as Retry-After says, and then shows it', async () => {
    // Arrange
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(answer(202, { 'Retry-After': '5' })).mockResolvedValueOnce(answer(206));
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
    expect(fetchMock).toHaveBeenCalledWith(pdf.url, expect.objectContaining({ headers: { Range: 'bytes=0-0' } }));
    expect(screen.getByTestId('pdf-visor')).toHaveAttribute('src', pdf.url);
  });

  it('a quote without a document says it, without an empty frame', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(409)));
    render(<Harness />);
    fireEvent.click(screen.getByText('abrir'));
    expect(await screen.findByTestId('pdf-no-disponible')).toHaveTextContent('todavía no se generó');
    expect(screen.queryByTestId('pdf-visor')).toBeNull();
  });

  it('a host that cannot be asked from here (no CORS) still opens in the frame, as before', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<Harness />);
    fireEvent.click(screen.getByText('abrir'));
    expect(await screen.findByTestId('pdf-visor')).toHaveAttribute('src', pdf.url);
  });
});
