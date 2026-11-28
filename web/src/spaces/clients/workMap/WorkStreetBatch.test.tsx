import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkMapView } from '@lilachat/shared';
import type { StreetSend } from './workProgressSender';
import { WorkStreetBatch } from './WorkStreetBatch';

type CanvasProps = { view: WorkMapView; pins?: Array<{ label: string }>; onTap?: (point: unknown, roads: unknown) => void };
vi.mock('./WorkMapCanvas', () => ({
  default: (props: CanvasProps) => (
    <div data-testid="mapa-lienzo" data-pins={(props.pins ?? []).map((pin) => pin.label).join(',')}>
      <button type="button" data-testid="lienzo-pinos" onClick={() => props.onTap?.(east(100), roadsAt(pinos, east(100)))} />
      <button type="button" data-testid="lienzo-monje" onClick={() => props.onTap?.(north(40), roadsAt(monje, north(40)))} />
    </div>
  ),
}));

/** ma02 «Marcar calles del área» on the web (José approved the prototype 28/11). */
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((12 * Math.PI) / 180);
const east = (meters: number) => ({ lat: -12, lng: -77 + meters / M_PER_DEG_LNG });
const north = (meters: number) => ({ lat: -12 + meters / M_PER_DEG_LAT, lng: east(200).lng });
const lineOf = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => ({ type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] });
const pinos = { properties: { class: 'minor', name: 'Jr. Los Pinos' }, geometry: lineOf(east(0), east(500)) };
const monje = { properties: { class: 'minor', name: 'Jr. Monje' }, geometry: lineOf(north(-150), north(150)) };
const roadsAt = (road: typeof pinos, tap: { lat: number; lng: number }) => ({ underFinger: [road], nearby: [road], tap });

const renderBatch = (send: StreetSend) => {
  const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onPartial: vi.fn() };
  render(<WorkStreetBatch title="Obra" map={null} send={send} {...handlers} />);
  return handlers;
};

describe('WorkStreetBatch', () => {
  it('two taps list two numbered streets and «Listo» saves both with their own ids', async () => {
    // Arrange
    const send = vi.fn<StreetSend>(async () => ({ ok: true, message: 'Calle guardada.' }));
    const handlers = renderBatch(send);
    // Act
    fireEvent.click(await screen.findByTestId('lienzo-pinos'));
    fireEvent.click(screen.getByTestId('lienzo-monje'));
    fireEvent.change(screen.getByTestId('lote-ancho-1'), { target: { value: '6' } });
    // Assert
    expect(screen.getByTestId('lote-total')).toHaveTextContent('2 calles · 800 m');
    expect(screen.getByTestId('mapa-lienzo')).toHaveAttribute('data-pins', '1,2');
    fireEvent.click(screen.getByTestId('lote-listo'));
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalledWith('2 calles guardadas. Ya aparecen en el mapa.'));
    expect(send.mock.calls.map(([draft]) => [draft.name, draft.widthM])).toEqual([['Jr. Los Pinos', 6], ['Jr. Monje', null]]);
    expect(new Set(send.mock.calls.map(([, entryId]) => entryId)).size).toBe(2);
  });

  it('a failure keeps the street with Portal\'s message and reloads the saved ones', async () => {
    // Arrange
    const send = vi.fn<StreetSend>(async (draft) => (draft.name === 'Jr. Monje' ? { ok: false, message: 'La obra está cerrada.' } : { ok: true, message: 'ok' }));
    const handlers = renderBatch(send);
    // Act
    fireEvent.click(await screen.findByTestId('lienzo-pinos'));
    fireEvent.click(screen.getByTestId('lienzo-monje'));
    fireEvent.click(screen.getByTestId('lote-listo'));
    // Assert
    await waitFor(() => expect(handlers.onPartial).toHaveBeenCalled());
    expect(screen.getByTestId('lote-problema')).toHaveTextContent('Se guardó 1 de 2. Jr. Monje: La obra está cerrada.');
    expect(screen.getByTestId('lote-error-1')).toHaveTextContent('La obra está cerrada.');
    expect(screen.getByTestId('lote-listo')).toHaveTextContent('Listo · 1 calle');
  });

  it('a tap on a renamed street asks before taking it out; leaving with streets asks too', async () => {
    // Arrange
    const handlers = renderBatch(vi.fn<StreetSend>());
    fireEvent.click(await screen.findByTestId('lienzo-pinos'));
    fireEvent.change(screen.getByTestId('lote-nombre-1'), { target: { value: 'Cuadra 1' } });
    // Act
    fireEvent.click(screen.getByTestId('lienzo-pinos'));
    // Assert
    expect(screen.getByTestId('lote-pregunta')).toHaveTextContent('«Cuadra 1» tiene cambios. ¿Quitarla de la lista?');
    fireEvent.click(screen.getByTestId('lote-pregunta-si'));
    expect(screen.queryByTestId('lote-calle-1')).toBeNull();
    fireEvent.click(screen.getByTestId('lienzo-pinos'));
    fireEvent.click(screen.getByTestId('lote-cancelar'));
    expect(handlers.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('lote-pregunta-si'));
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('«Trazar a mano» opens the single-street editor by hand and adds to the list', async () => {
    // Arrange
    renderBatch(vi.fn<StreetSend>());
    // Act
    fireEvent.click(screen.getByTestId('lote-a-mano'));
    // Assert
    expect(await screen.findByTestId('editor-calle')).toBeInTheDocument();
    expect(screen.getByTestId('editor-modo-hand')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('editor-calle-guardar')).toHaveTextContent('Agregar a la lista');
    fireEvent.click(screen.getByTestId('editor-calle-cerrar'));
    expect(screen.getByTestId('lote-calles')).toBeInTheDocument();
  });
});
