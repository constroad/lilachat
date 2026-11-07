import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkMapView } from '@lilachat/shared';
import { WorkStreetEditor } from './WorkStreetEditor';

vi.mock('./WorkMapCanvas', () => ({
  default: (props: { view: WorkMapView; pins?: unknown[] }) => <div data-testid="mapa-lienzo" data-pins={props.pins?.length ?? 0} />,
}));

/** «Caminar con GPS» (design o-13, step 3, José 07/11) on the web. */
const M_PER_DEG_LNG = 111_195 * Math.cos((12 * Math.PI) / 180);
type Report = (position: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
let report: Report = () => undefined;
const clearWatch = vi.fn();

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: vi.fn((success: Report) => { report = success; return 7; }), clearWatch },
  });
});
afterEach(() => clearWatch.mockClear());

const walkTo = (meters: number) => act(() => report({ coords: { latitude: -12, longitude: -77 + meters / M_PER_DEG_LNG, accuracy: 4 } }));

describe('WorkStreetEditor, walking with GPS', () => {
  it('walks the street and saves the walked line', async () => {
    // Arrange
    const send = vi.fn(async () => ({ ok: true as const, message: 'Calle guardada.' }));
    render(<WorkStreetEditor title="Obra" map={null} send={send} onClose={vi.fn()} onSaved={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('editor-modo-gps'));
    expect(screen.getByTestId('editor-calle-ayuda')).toHaveTextContent('Toca «Empezar» y camina por el eje de la calle.');
    fireEvent.click(screen.getByTestId('editor-gps-empezar'));
    walkTo(0);
    walkTo(60);
    walkTo(120);
    expect(screen.getByTestId('editor-calle-ayuda')).toHaveTextContent('Caminando · 120 m · GPS ±4 m');
    fireEvent.click(screen.getByTestId('editor-gps-terminar'));
    fireEvent.change(screen.getByTestId('editor-calle-nombre'), { target: { value: 'Jr. Caminado' } });
    fireEvent.click(screen.getByTestId('editor-calle-guardar'));
    // Assert
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('120 m');
    expect((await screen.findByTestId('mapa-lienzo')).dataset.pins).toBe('2');
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]![0]).toMatchObject({ name: 'Jr. Caminado', mode: 'gps' });
  });

  it('«Deshacer» throws the walk away to walk again', () => {
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('editor-modo-gps'));
    fireEvent.click(screen.getByTestId('editor-gps-empezar'));
    walkTo(0);
    walkTo(50);
    fireEvent.click(screen.getByTestId('editor-calle-deshacer'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('0 m');
    expect(screen.getByTestId('editor-gps-empezar')).toBeTruthy();
  });

  it('a browser without location says so', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('editor-modo-gps'));
    fireEvent.click(screen.getByTestId('editor-gps-empezar'));
    expect(screen.getByTestId('editor-calle-ayuda')).toHaveTextContent('El navegador no deja usar tu ubicación');
  });
});
