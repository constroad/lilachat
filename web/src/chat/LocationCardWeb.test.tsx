import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationCardWeb } from './LocationCardWeb';

describe('a shared location on the web (pending 11)', () => {
  it('draws the map with the pin, the accuracy and a link to the map app', () => {
    render(<LocationCardWeb location={{ lat: -12.046374, lng: -77.042793, accuracy: 12 }} mio={false} />);
    const card = screen.getByTestId('tarjeta-ubicacion');
    expect(card.querySelectorAll('img[src^="https://tile.openstreetmap.org/16/"]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('pin-ubicacion')).toBeTruthy();
    expect(card.textContent).toContain('Precisión 12 m');
    expect(card.textContent).toContain('© OpenStreetMap');
    expect(screen.getByTestId('btn-abrir-mapa').getAttribute('href')).toBe('https://www.google.com/maps/search/?api=1&query=-12.046374%2C-77.042793');
  });

  it('without an accuracy it says nothing about it', () => {
    render(<LocationCardWeb location={{ lat: 1, lng: 2 }} mio />);
    expect(screen.getByTestId('tarjeta-ubicacion').textContent).not.toContain('Precisión');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('a live one says until when, and its author can stop it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ended: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const liveUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    render(<LocationCardWeb location={{ lat: 1, lng: 2, liveUntil }} mio live={{ jwt: 'jwt-de-prueba', chatId: '6720f0a1b2c3d4e5f6a7b8c9', seq: 42 }} />);
    expect(screen.getByTestId('estado-tiempo-real').textContent).toMatch(/^En tiempo real · hasta /);
    fireEvent.click(screen.getByTestId('btn-dejar-de-compartir'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chats/6720f0a1b2c3d4e5f6a7b8c9/locations/42/stop', expect.objectContaining({ method: 'POST' })));
  });

  it('someone else\'s live location cannot be stopped from here', () => {
    const liveUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    render(<LocationCardWeb location={{ lat: 1, lng: 2, liveUntil }} mio={false} live={{ jwt: 'jwt-de-prueba', chatId: '6720f0a1b2c3d4e5f6a7b8c9', seq: 42 }} />);
    expect(screen.queryByTestId('btn-dejar-de-compartir')).toBeNull();
  });

  it('an ended one says so, without the button', () => {
    render(<LocationCardWeb location={{ lat: 1, lng: 2, liveUntil: new Date(Date.now() + 60_000).toISOString(), endedAt: new Date().toISOString() }} mio live={{ jwt: 'jwt-de-prueba', chatId: '6720f0a1b2c3d4e5f6a7b8c9', seq: 42 }} />);
    expect(screen.getByTestId('estado-tiempo-real').textContent).toBe('Ya no comparte su ubicación');
    expect(screen.queryByTestId('btn-dejar-de-compartir')).toBeNull();
  });

  it('a live one whose points stopped says «Sin señal desde» (pending 12)', () => {
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    render(<LocationCardWeb location={{ lat: 1, lng: 2, liveUntil: new Date(Date.now() + 3_600_000).toISOString(), updatedAt: old }} mio={false} />);
    expect(screen.getByTestId('sin-senal').textContent).toContain('Sin señal desde');
  });

  it('the map opens inside Lilachat, bigger and with zoom (pending 12)', () => {
    render(<LocationCardWeb location={{ lat: -12.046374, lng: -77.042793 }} mio={false} />);
    fireEvent.click(screen.getByTestId('btn-ver-mapa'));
    const dialog = screen.getByTestId('mapa-en-vivo');
    expect(dialog.querySelectorAll('img[src^="https://tile.openstreetmap.org/16/"]').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('btn-acercar-mapa'));
    expect(dialog.querySelectorAll('img[src^="https://tile.openstreetmap.org/17/"]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('btn-como-llegar').getAttribute('href')).toContain('google.com/maps');
  });
});
