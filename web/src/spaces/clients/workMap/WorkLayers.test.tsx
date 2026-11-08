import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapEditSend, WorkMap } from '@lilachat/shared';
import { useBrush, WorkLayers } from './WorkLayers';

/** o-04 «Etapas» and o-05 «Trabajos» (audit 08/11 item 2): cards, and the brush that paints streets. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.998 }];
const map: WorkMap = {
  streets: [{ id: 's1', name: 'Av. Los Incas', line, lengthM: 218, widthM: 6 }, { id: 's2', name: 'Calle Tacna', line: [{ lat: -12.01, lng: -77 }, { lat: -12.01, lng: -76.998 }], lengthM: 218 }],
  scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 218, workIds: ['base'], stageId: 'e1' }],
  progress: [{ streetId: 's1', workId: 'base', fromM: 0, toM: 109, date: '2026-11-12', rework: false }],
  works: [{ id: 'base', name: 'Base', color: '#d97706' }],
  stages: [{ id: 'e1', name: 'Etapa 1' }],
};
const ok: MapEditSend = async () => ({ ok: true, message: 'ok' });

describe('WorkLayers', () => {
  it('shows each stage with its figures, the streets without one, and arms the brush', () => {
    // Arrange
    const onBrush = vi.fn();
    render(<WorkLayers map={map} kind="stages" send={ok} brush={null} onBrush={onBrush} onClose={vi.fn()} />);
    // Assert
    expect(screen.getByTestId('etapa-e1')).toHaveTextContent('Etapa 1');
    expect(screen.getByTestId('etapa-e1')).toHaveTextContent('50 %');
    expect(screen.getByTestId('etapa-e1')).toHaveTextContent('1 calle · 218 m · 1 308 m²');
    expect(screen.getByTestId('etapa-e1')).toHaveTextContent('Jornada del 12 nov');
    expect(screen.getByTestId('etapas-sin-etapa')).toHaveTextContent('Calle Tacna');
    // Act
    fireEvent.click(screen.getByTestId('etapa-brocha-e1'));
    // Assert
    expect(onBrush).toHaveBeenCalledWith({ kind: 'stage', id: 'e1' });
  });

  it('numbers the works and paints one with the brush', () => {
    const onBrush = vi.fn();
    render(<WorkLayers map={map} kind="works" send={ok} brush={{ kind: 'work', id: 'base' }} onBrush={onBrush} onClose={vi.fn()} />);
    expect(screen.getByTestId('trabajo-fila-base')).toHaveTextContent('1');
    expect(screen.getByTestId('trabajo-fila-base')).toHaveTextContent('1 calle · 218 m');
    expect(screen.getByText('Una calle sin un trabajo no cuenta como pendiente.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trabajo-brocha-base'));
    expect(onBrush).toHaveBeenCalledWith(null);
  });

  it('creates a stage right there', async () => {
    const send = vi.fn<MapEditSend>(ok);
    render(<WorkLayers map={map} kind="stages" send={send} brush={null} onBrush={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('etapa-nueva'));
    fireEvent.change(screen.getByTestId('etapa-nombre'), { target: { value: 'Etapa 2' } });
    fireEvent.click(screen.getByTestId('etapa-crear'));
    await waitFor(() => expect(send).toHaveBeenCalledWith({ kind: 'work_stage', name: 'Etapa 2', forms: expect.any(Number) }, expect.any(Function)));
  });
});

describe('useBrush', () => {
  it('a tap on a street sends its stretches; «Deshacer» puts them back', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(ok);
    const { result, rerender } = renderHook(({ current }) => useBrush(current, send), { initialProps: { current: map } });
    act(() => result.current.setBrush({ kind: 'work', id: 'base' }));
    // Act
    await act(() => result.current.tap({ lat: -12.01, lng: -76.999 }));
    // Assert
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'work_scope', street_id: 's2', tag_ids: ['base'], from_m: 0, to_m: 218 }), expect.any(Function));
    rerender({ current: { ...map, scopes: [...map.scopes, { id: 'c2', streetId: 's2', fromM: 0, toM: 218, workIds: ['base'] }] } });
    await act(() => result.current.undo());
    expect(send).toHaveBeenLastCalledWith({ kind: 'work_scope_delete', scope_id: 'c2', forms: expect.any(Number) }, expect.any(Function));
    expect(result.current.canUndo).toBe(false);
  });

  it('the last work of a stretch is not removed: Portal refuses an empty stretch', async () => {
    const send = vi.fn<MapEditSend>(ok);
    const { result } = renderHook(() => useBrush(map, send));
    act(() => result.current.setBrush({ kind: 'work', id: 'base' }));
    await act(() => result.current.tap({ lat: -12, lng: -76.999 }));
    expect(result.current.error).toBe('Es el único trabajo de esta calle. Para quitarlo, borra el tramo en «Ver tramos».');
    expect(send).not.toHaveBeenCalled();
  });

  it('a tap off the work says so and sends nothing', async () => {
    const send = vi.fn<MapEditSend>(ok);
    const { result } = renderHook(() => useBrush(map, send));
    act(() => result.current.setBrush({ kind: 'work', id: 'base' }));
    await act(() => result.current.tap({ lat: -12.5, lng: -76.999 }));
    expect(result.current.error).toBe('Toca sobre una calle de la obra.');
    expect(send).not.toHaveBeenCalled();
  });
});
