import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_WORK_MAP, NO_HIDDEN_LAYERS, NO_REPORT_LAYER, workMapView, type MapPhoto } from '@lilachat/shared';
import { MapLayersPanel } from './MapLayersPanel';
import { usePhotoLayer } from './MapPhotos';

/** José 19/11 (as Portal f080f7c6a): «Fotos» split in sub-layers by report type, each with its switch and count. */
const photo = (id: string, lat: number, reportType?: string): MapPhoto => ({ id, lat, lng: -77, at: '2026-11-19T15:00:00Z', kind: 'photo', url: `https://x/${id}.jpg`, thumbnailUrl: `https://x/${id}-t.jpg`, ...(reportType ? { reportType } : {}) });
const photos = [photo('a', -12, 'CTL-PIS'), photo('b', -12.01, 'CTL-PIS'), photo('c', -12.02, 'CTL-IMP'), photo('d', -12.03)];

describe('usePhotoLayer by report', () => {
  it('a hidden report type leaves the pins; the rows keep every type with its count', () => {
    // Arrange
    const { result } = renderHook(() => usePhotoLayer(EMPTY_WORK_MAP, photos));
    const before = result.current.pins.length;
    // Act
    act(() => result.current.toggleReport('CTL-PIS'));
    // Assert
    expect(before).toBe(4);
    expect(result.current.pins).toHaveLength(2);
    expect(result.current.reports.map((row) => [row.type, row.count, row.shown])).toEqual([['CTL-PIS', 2, false], ['CTL-IMP', 1, true], [NO_REPORT_LAYER, 1, true]]);
  });
});

describe('the «Fotos» section of «Capas y leyenda»', () => {
  it('lists a switch per report type under «Fotos», with readable names, and each switch toggles its type', () => {
    // Arrange
    const onToggleReport = vi.fn();
    const reports = [{ type: 'CTL-PIS', label: 'Control de pista', count: 2, shown: true }, { type: NO_REPORT_LAYER, label: 'Otras fotos de campo', count: 1, shown: false }];
    render(<MapLayersPanel map={EMPTY_WORK_MAP} view={workMapView(EMPTY_WORK_MAP)} filter={{}} onFilter={vi.fn()} layers={NO_HIDDEN_LAYERS} onToggle={vi.fn()} photos={{ count: 3, shown: true, onToggle: vi.fn(), reports, onToggleReport }} />);
    // Act
    fireEvent.click(screen.getByTestId('capa-fotos-CTL-PIS'));
    // Assert
    expect(screen.getByTestId('capa-fotos-informes')).toHaveTextContent('Control de pista (2)');
    expect(screen.getByTestId('capa-fotos-informes')).toHaveTextContent('Otras fotos de campo (1)');
    expect(screen.getByTestId(`capa-fotos-${NO_REPORT_LAYER}`)).toHaveAttribute('aria-checked', 'false');
    expect(onToggleReport).toHaveBeenCalledWith('CTL-PIS');
  });
});
