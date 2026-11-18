import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProspectField } from '@lilachat/shared';
import { DocumentFieldRow } from './DocumentFieldRow';

const FILE = 'a'.repeat(24);
const LOT = [{ lat: -12.05, lng: -77.03 }, { lat: -12.051, lng: -77.03 }, { lat: -12.051, lng: -77.031 }];
const read: ProspectField = { key: 'area', label: 'Área', value: '3 200 m² según el KML', source: 'document', fileId: FILE, confirmed: false };
const show = (field: ProspectField, onSettle = vi.fn().mockResolvedValue(undefined)) => {
  render(<dl><DocumentFieldRow field={field} onSettle={onSettle} /></dl>);
  return onSettle;
};

afterEach(cleanup);

describe('DocumentFieldRow (fase 3: the seller settles what Dali read)', () => {
  it('confirms it as it is', () => {
    const onSettle = show(read);
    fireEvent.click(screen.getByTestId('confirmar-area'));
    expect(onSettle).toHaveBeenCalledWith('area');
  });

  it('corrects it with the right value, trimmed; an empty one cannot be saved', () => {
    const onSettle = show(read);
    fireEvent.click(screen.getByTestId('corregir-area'));
    const input = screen.getByTestId('corregir-valor-area');
    fireEvent.change(input, { target: { value: '   ' } });
    expect((screen.getByTestId('guardar-correccion-area') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: ' 3 150 m² ' } });
    fireEvent.click(screen.getByTestId('guardar-correccion-area'));
    expect(onSettle).toHaveBeenCalledWith('area', '3 150 m²');
  });

  it('says who confirmed it, without the actions', () => {
    show({ ...read, confirmed: true, confirmedBy: { id: 'b'.repeat(24), name: 'Rosa Quispe', at: '2026-11-17T20:00:00.000Z' } });
    expect(screen.getByTestId('confirmado-area').textContent).toBe('Confirmado por Rosa Quispe');
    expect(screen.queryByTestId('confirmar-area')).toBeNull();
  });

  it('draws the lot of a KML; a field without geo has no map', () => {
    show({ ...read, geo: { polygon: LOT, points: [{ lat: -12.0505, lng: -77.0305, label: 'Ingreso' }] } });
    const map = screen.getByTestId('mapa-dato-area');
    expect(map.querySelector('polygon')?.getAttribute('points')?.split(' ')).toHaveLength(3);
    expect(map.textContent).toContain('Ingreso');
    cleanup();
    show({ key: 'lugar', label: 'Lugar', value: 'Ate' });
    expect(screen.queryByTestId('mapa-dato-lugar')).toBeNull();
    expect(screen.queryByTestId('confirmar-lugar')).toBeNull();
  });
});
