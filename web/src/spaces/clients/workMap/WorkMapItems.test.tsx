import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { MapCard, WorkMap } from '@lilachat/shared';
import { MapCardView } from './MapCardView';
import { WorkMapItems } from './WorkMapItems';

afterEach(cleanup);

const symbol = (id: string, type: string, note?: string) => ({ id, type, ...(note ? { note } : {}), shape: { kind: 'symbol' as const, at: { lat: -12, lng: -77 } } });
const map: WorkMap = {
  streets: [], scopes: [], progress: [], works: [], stages: [],
  marks: [symbol('a', 'otro', 'Parche 1'), symbol('b', 'giba', 'Frente al colegio'), symbol('c', 'otro', 'Parche 2')],
  observations: [{ id: 'o1', text: 'Tapa', status: 'resolved', photos: [], point: { lat: -12, lng: -77 } }, { id: 'o2', text: 'Fisura', status: 'open', photos: [{ url: 'https://lila.example/a.jpg' }] }],
};

/** José 19/11: the panel lists what Portal drew and what was observed. */
describe('WorkMapItems', () => {
  it('groups the drawings by type with their count and picks one', () => {
    // Arrange
    const onPick = vi.fn();
    render(<WorkMapItems map={map} onPick={onPick} />);
    // Act
    fireEvent.click(screen.getByTestId('mapa-dibujo-b'));
    // Assert
    expect(within(screen.getByTestId('mapa-dibujos')).getByText('Otro')).toHaveTextContent('2');
    expect(screen.getByTestId('mapa-dibujo-b')).toHaveTextContent('Frente al colegio');
    expect(onPick).toHaveBeenCalledWith({ kind: 'mark', id: 'b' });
  });

  it('lists the observations open first, with their pill and photos', () => {
    // Act
    render(<WorkMapItems map={map} onPick={vi.fn()} />);
    // Assert
    const rows = within(screen.getByTestId('mapa-observaciones')).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Fisura');
    expect(rows[0]).toHaveTextContent('Pendiente');
    expect(rows[0]).toHaveTextContent('1 foto · sin ubicación');
    expect(rows[1]).toHaveTextContent('Levantada');
  });

  it('without drawings nor observations there is no list', () => {
    const { container } = render(<WorkMapItems map={{ ...map, marks: [], observations: [] }} onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MapCardView', () => {
  const card: MapCard = { id: 'o1', kind: 'observation', title: 'Tapa hundida', status: { label: 'Levantada', tone: 'ok' }, note: 'Nivelada', dates: ['Registrada 10/11 · 10:00'], near: ['a 20 m de Buzón'], photos: [{ url: 'https://lila.example/a.jpg', name: 'Antes · Tapa hundida', mime: 'image/jpeg' }] };

  it('shows what it is, its state, dates, what is near, and a thumbnail opens the photo', () => {
    // Arrange
    const onPhoto = vi.fn();
    const onClose = vi.fn();
    render(<MapCardView card={card} onPhoto={onPhoto} onClose={onClose} />);
    // Act
    fireEvent.click(screen.getByTestId('tarjeta-foto-0'));
    fireEvent.click(screen.getByTestId('tarjeta-cerrar'));
    // Assert
    const shown = screen.getByTestId('tarjeta-observation-o1');
    expect(shown).toHaveTextContent('Levantada');
    expect(shown).toHaveTextContent('Nivelada');
    expect(screen.getByTestId('tarjeta-cerca')).toHaveTextContent('a 20 m de Buzón');
    expect(onPhoto).toHaveBeenCalledWith(card.photos[0], card.photos);
    expect(onClose).toHaveBeenCalled();
  });

  it('a hover card has no close button', () => {
    render(<MapCardView card={{ ...card, kind: 'mark', status: undefined, size: 'Ø 4 m', photos: [] }} />);
    expect(screen.queryByTestId('tarjeta-cerrar')).not.toBeInTheDocument();
    expect(screen.getByTestId('tarjeta-tamano')).toHaveTextContent('Ø 4 m');
  });
});
