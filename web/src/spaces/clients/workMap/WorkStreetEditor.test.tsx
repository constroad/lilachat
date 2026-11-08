import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkMapView } from '@lilachat/shared';
import type { StreetSend } from './workProgressSender';
import { WorkStreetEditor } from './WorkStreetEditor';

type CanvasProps = { view: WorkMapView; pins?: unknown[]; handles?: Array<{ label: string }>; onTap?: (point: unknown, roads: unknown) => void; onHandleDrop?: (handle: 'start' | 'end', point: unknown) => void };
vi.mock('./WorkMapCanvas', () => ({
  default: (props: CanvasProps) => (
    <div data-testid="mapa-lienzo" data-pins={props.pins?.length ?? 0} data-handles={(props.handles ?? []).map((one) => one.label).join(',')}>
      <button type="button" data-testid="lienzo-tocar-calle" onClick={() => props.onTap?.(east(100), roadsAt(100))} />
      <button type="button" data-testid="lienzo-soltar-fin" onClick={() => props.onHandleDrop?.('end', east(400))} />
    </div>
  ),
}));

/** «Caminar con GPS» (design o-13, step 3, José 07/11) on the web. */
const M_PER_DEG_LNG = 111_195 * Math.cos((12 * Math.PI) / 180);
const east = (meters: number) => ({ lat: -12, lng: -77 + meters / M_PER_DEG_LNG });
const road = (name?: string) => ({ properties: { class: 'minor', ...(name ? { name } : {}) }, geometry: { type: 'LineString', coordinates: [[east(0).lng, -12], [east(500).lng, -12]] } });
const roadsAt = (meters: number) => ({ underFinger: [road()], nearby: [road('Jr. Los Pinos')], tap: east(meters) });
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
    const send = vi.fn<StreetSend>(async () => ({ ok: true, message: 'Calle guardada.' }));
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

  it('«Deshacer» takes back the last stretch walked, not the whole walk (audit 08/11 item 12)', async () => {
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('editor-modo-gps'));
    fireEvent.click(screen.getByTestId('editor-gps-empezar'));
    walkTo(0);
    walkTo(30);
    walkTo(60);
    expect((await screen.findByTestId('mapa-lienzo')).dataset.pins).toBe('3');
    fireEvent.click(screen.getByTestId('editor-calle-deshacer'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('30 m');
    expect(screen.getByTestId('editor-gps-terminar')).toBeTruthy();
  });

  it('«Pausa» stops drawing until «Seguir», and the hint says so', () => {
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('editor-modo-gps'));
    fireEvent.click(screen.getByTestId('editor-gps-empezar'));
    walkTo(0);
    walkTo(40);
    fireEvent.click(screen.getByTestId('editor-gps-pausa'));
    walkTo(90);
    expect(screen.getByTestId('editor-calle-ayuda')).toHaveTextContent('En pausa · 40 m caminados.');
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('40 m');
    fireEvent.click(screen.getByTestId('editor-gps-seguir'));
    walkTo(100);
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('100 m');
  });

  it('a browser without location says so', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('editor-modo-gps'));
    fireEvent.click(screen.getByTestId('editor-gps-empezar'));
    expect(screen.getByTestId('editor-calle-ayuda')).toHaveTextContent('El navegador no deja usar tu ubicación');
  });
});

describe('WorkStreetEditor, what the audit of 08/11 found', () => {
  const walked = () => {
    fireEvent.click(screen.getByTestId('editor-modo-gps'));
    fireEvent.click(screen.getByTestId('editor-gps-empezar'));
    walkTo(0);
    walkTo(80);
    fireEvent.click(screen.getByTestId('editor-gps-terminar'));
  };

  it('switching the way to draw asks before erasing what was walked', () => {
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    walked();
    fireEvent.click(screen.getByTestId('editor-modo-hand'));
    expect(screen.getByTestId('editor-calle-cambiar-modo')).toHaveTextContent('Cambiar de forma borra lo que marcaste (80 m). ¿Cambiar igual?');
    fireEvent.click(screen.getByTestId('editor-calle-cambiar-no'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('80 m');
    fireEvent.click(screen.getByTestId('editor-modo-hand'));
    fireEvent.click(screen.getByTestId('editor-calle-cambiar-si'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('0 m');
  });

  it('the stage is chosen with the street and travels with it', async () => {
    const send = vi.fn<StreetSend>(async () => ({ ok: true, message: 'Calle guardada.' }));
    const map = { streets: [], scopes: [], progress: [], works: [], stages: [{ id: 'e2', name: 'Etapa 2' }] };
    render(<WorkStreetEditor title="Obra" map={map} send={send} onClose={vi.fn()} onSaved={vi.fn()} />);
    walked();
    fireEvent.change(screen.getByTestId('editor-calle-nombre'), { target: { value: 'Psje. Sol' } });
    fireEvent.change(screen.getByTestId('editor-calle-etapa'), { target: { value: 'e2' } });
    fireEvent.click(screen.getByTestId('editor-calle-guardar'));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]![0]).toMatchObject({ name: 'Psje. Sol', stageId: 'e2' });
  });

  it('without stages there is no stage field', () => {
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByTestId('editor-calle-etapa')).toBeNull();
  });
});

describe('WorkStreetEditor, trimming the picked street (José 08/11)', () => {
  it('the ends of the street drag, and «−10 m» / «+10 m» fine-tune the end', async () => {
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('lienzo-tocar-calle'));
    expect(screen.getByTestId('mapa-lienzo').dataset.handles).toBe('0+000,0+500');
    expect(screen.getByTestId('mapa-lienzo').dataset.pins).toBe('0');
    fireEvent.click(screen.getByTestId('lienzo-soltar-fin'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('400 m');
    expect(screen.getByTestId('mapa-lienzo').dataset.handles).toBe('0+000,0+400');
    fireEvent.click(screen.getByTestId('editor-fin-mas'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('410 m');
    fireEvent.click(screen.getByTestId('editor-inicio-mas'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('400 m');
  });

  it('without a street picked there is nothing to trim', () => {
    render(<WorkStreetEditor title="Obra" map={null} send={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByTestId('editor-extremos')).toBeNull();
  });
});
