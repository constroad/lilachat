import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
