import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinkSortingRow } from './LinkSortingRow';

afterEach(() => vi.unstubAllGlobals());

describe('«Ordenar enlaces por categoría» (José 18/11)', () => {
  it('turning it on saves it and says Lila takes a minute or two', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<LinkSortingRow chatId="n1" jwt="t" on={false} onNotice={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('interruptor-ordenar-enlaces'));
    // Assert
    await waitFor(() => expect(screen.getByTestId('fila-ordenar-enlaces')).toHaveTextContent('Lila lee tus enlaces y los ordena. Tarda uno o dos minutos.'));
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/n1/link-sorting', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ enabled: true }) }));
    expect(screen.getByTestId('interruptor-ordenar-enlaces')).toBeChecked();
  });

  it('a refusal goes back and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Solo en un chat de notas.' }), { status: 400 })));
    const onNotice = vi.fn();
    render(<LinkSortingRow chatId="n1" jwt="t" on onNotice={onNotice} />);
    fireEvent.click(screen.getByTestId('interruptor-ordenar-enlaces'));
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Solo en un chat de notas.'));
    expect(screen.getByTestId('interruptor-ordenar-enlaces')).toBeChecked();
  });
});
