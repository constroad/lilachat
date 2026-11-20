import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MapMoreMenu } from './MapMoreMenu';

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
