import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { activeLayerOf, workMapOf, type ByApproveList, type WorkMap } from '@lilachat/shared';
import { LayerSheet } from './LayerSheet';
import { LayerChips } from './LayerChips';

/** Design ma01 on the web: the active layer's sheet and the strip of layers. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const TODAY = '2026-11-28';
const map: WorkMap = workMapOf({
  workStreets: {
    streets: [{ _id: 's1', name: 'Jr. Progreso', geometry: line, lengthM: 284, widthM: 6 }, { _id: 's2', name: 'Jr. Monje', geometry: line, lengthM: 223 }],
    scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 284, tagIds: ['imp'], partidaIds: [] }, { _id: 'c2', streetId: 's2', fromM: 0, toM: 223, tagIds: ['car'], partidaIds: [] }],
    progress: [{ streetId: 's1', tagId: 'imp', fromM: 0, toM: 120, date: '2026-11-27' }],
    tags: [{ _id: 'imp', name: 'Imprimación', color: '#d97706', order: 1 }, { _id: 'car', name: 'Carpeta asfáltica 2"', color: '#2563eb', order: 2 }],
    stages: [],
  },
})!;
const list: ByApproveList = { total: 1, items: [{ id: 'a2', state: 'pendiente', date: TODAY, streetId: 's1', fromM: 120, toM: 166, workId: 'imp', quantity: 46, author: 'Juan', own: true, rejectNote: null }] };

describe('LayerSheet', () => {
  it('shows the layer figure, its streets, what waits hatched and the latest line', () => {
    // Arrange
    const layer = activeLayerOf(map, list, null, TODAY);
    const onRecord = vi.fn();
    // Act
    render(<LayerSheet summary={layer.summary!} latest={layer.latest} onRecord={onRecord} />);
    fireEvent.click(screen.getByTestId('capa-registrar'));
    // Assert
    expect(screen.getByTestId('mapa-avance').textContent).toContain('720 de 1 704 m²');
    expect(screen.getByTestId('mapa-avance').textContent).toContain('42 %');
    expect(screen.getByTestId('capa-calle-s1')).toBeTruthy();
    expect(screen.getAllByTestId('capa-por-aprobar').length).toBeGreaterThan(0);
    expect(screen.getByTestId('capa-ultimo').textContent).toContain('Último: hoy · Jr. Progreso +46 m');
    expect(screen.getByTestId('capa-ultimo').textContent).toContain('por aprobar');
    expect(screen.getByText('Registrar avance de Imprimación')).toBeTruthy();
    expect(onRecord).toHaveBeenCalledOnce();
  });

  it('says it is in metres when the street has no width, and has no button without a way to record', () => {
    // Arrange
    const layer = activeLayerOf(map, null, 'car', TODAY);
    // Act
    render(<LayerSheet summary={layer.summary!} latest={layer.latest} />);
    // Assert
    expect(screen.getByTestId('capa-sin-ancho').textContent).toBe('En metros: 1 calle sin ancho');
    expect(screen.queryByTestId('capa-registrar')).toBeNull();
    expect(screen.queryByTestId('capa-ultimo')).toBeNull();
  });
});

describe('LayerChips', () => {
  it('shows names (a long one cut with «…» so its % stays whole, José 28/11) with their percent and picks a layer', () => {
    // Arrange
    const onPick = vi.fn();
    const { chips } = activeLayerOf(map, null, null, TODAY);
    // Act
    render(<LayerChips testPrefix="mapa-capa" chips={chips} onPick={onPick} />);
    fireEvent.click(screen.getByTestId('mapa-capa-car'));
    // Assert
    expect(screen.getByTestId('mapa-capa-car').textContent).toBe('Carpeta asfál… 0 %');
    expect(screen.getByTestId('mapa-capa-car')).toHaveAttribute('aria-label', 'Carpeta asfáltica 2" 0 %');
    expect(screen.getByTestId('mapa-capa-imp').getAttribute('aria-pressed')).toBe('true');
    expect(onPick).toHaveBeenCalledWith('car');
    expect(screen.queryByTestId('avance-trabajo-nuevo')).toBeNull();
  });

  it('draws nothing without layers on the map', () => {
    // Act
    const { container } = render(<LayerChips testPrefix="mapa-capa" chips={[]} onPick={vi.fn()} />);
    // Assert
    expect(container.innerHTML).toBe('');
  });
});
