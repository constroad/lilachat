import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContactCardWeb } from './ContactCardWeb';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Pending 9 (José, 20/10): a shared contact in the chat, like WhatsApp Web. */
describe('ContactCardWeb', () => {
  it('name and phone; «Enviar mensaje» opens the chat with that person', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ chatId: 'c9' }), { status: 200 }));
    const navigated = vi.fn();
    window.addEventListener('popstate', navigated);
    render(<ContactCardWeb contact={{ name: 'QA Ana', phone: '987654321', userId: 'u-ana' }} mio={false} jwt="jwt" yo="u-yo" />);
    expect(screen.getByText('QA Ana')).toBeTruthy();
    expect(screen.getByText('987 654 321')).toBeTruthy();
    fireEvent.click(screen.getByTestId('contacto-enviar-mensaje'));
    await waitFor(() => expect(navigated).toHaveBeenCalled());
    expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toEqual({ kind: 'direct', memberIds: ['u-ana'] });
    expect(location.pathname).toBe('/c/c9');
    window.removeEventListener('popstate', navigated);
  });

  it('someone not on Lilachat, or myself, has no «Enviar mensaje»', () => {
    render(<ContactCardWeb contact={{ name: 'Pepe', phone: '912345678' }} mio={false} jwt="jwt" yo="u-yo" />);
    expect(screen.queryByTestId('contacto-enviar-mensaje')).toBeNull();
    cleanup();
    render(<ContactCardWeb contact={{ name: 'Yo', phone: '902049935', userId: 'u-yo' }} mio jwt="jwt" yo="u-yo" />);
    expect(screen.queryByTestId('contacto-enviar-mensaje')).toBeNull();
  });
});
