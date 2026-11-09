import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MapMoreMenu } from './MapMoreMenu';
import { MapLegend } from './WorkMapOverlays';

/** José 09/11: the actions were piled up; the rest goes under «Más», and the legend folds. */
describe('«Más» over the work map', () => {
  it('opens its list, runs the one picked and closes', () => {
    // Arrange
    const onPick = vi.fn();
    render(<MapMoreMenu pageUrl="https://portal/x" onPick={onPick} draws edits admin className="" />);
    // Act
    fireEvent.click(screen.getByTestId('mapa-mas'));
    fireEvent.click(screen.getByTestId('mapa-trabajos-abrir'));
    // Assert
    expect(onPick).toHaveBeenCalledWith('works');
    expect(screen.queryByTestId('mapa-mas-menu')).toBeNull();
  });

  it('who only looks gets export and Portal; Escape and a click outside close it', () => {
    render(<div><span data-testid="fuera">x</span><MapMoreMenu pageUrl="https://portal/x" onPick={vi.fn()} draws={false} edits={false} admin={false} className="" /></div>);
    fireEvent.click(screen.getByTestId('mapa-mas'));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Exportar', 'Abrir en Portal']);
    expect(screen.getByTestId('mapa-abrir')).toHaveAttribute('target', '_blank');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(screen.queryByTestId('mapa-mas-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('mapa-mas'));
    fireEvent.pointerDown(screen.getByTestId('fuera'));
    expect(screen.queryByTestId('mapa-mas-menu')).toBeNull();
  });
});

describe('the folding legend', () => {
  const view = { works: [{ id: 'w1', name: 'Base granular', color: '#a16207', percent: 100 }] } as never;

  it('folded until asked; open, it names what waits for approval', () => {
    // Arrange
    render(<MapLegend view={view} waiting={2} compact />);
    expect(screen.queryByTestId('mapa-leyenda')).toBeNull();
    // Act
    fireEvent.click(screen.getByTestId('mapa-leyenda-abrir'));
    // Assert
    expect(screen.getByTestId('mapa-leyenda')).toHaveTextContent('Base granularPendiente de ejecuciónPor aprobar (2)');
  });

  it('nothing to approve, no such line', () => {
    render(<MapLegend view={view} waiting={0} compact={false} />);
    fireEvent.click(screen.getByTestId('mapa-leyenda-abrir'));
    expect(screen.getByTestId('mapa-leyenda')).not.toHaveTextContent('Por aprobar');
  });
});
