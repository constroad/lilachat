import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { byApproveOf, MANUAL_SENT, withPendingOf, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { AvanceTop, useAvanceMode } from './AvanceMode';
import { AvancePanel } from './AvancePanel';

/** «Modo Avance» (design av-01, José 27/11): chips of works, a tap on a street, a big percent, save. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
const MAP: WorkMap = {
  streets: [{ id: 's1', name: 'Jr. Lima', line, lengthM: 120 }],
  scopes: [{ id: 'c1', streetId: 's1', fromM: 0, toM: 120, workIds: ['imp'] }],
  progress: [{ streetId: 's1', workId: 'imp', fromM: 0, toM: 60, date: '2026-11-20', rework: false }],
  works: [{ id: 'imp', name: 'Imprimación', color: '#2563eb' }, { id: 'base', name: 'Base', color: '#d97706' }],
  stages: [],
};
const ON_STREET = { lat: -12, lng: -76.9995 };
const OFF_STREET = { lat: -12.01, lng: -76.9995 };
const NO_FILTER = {};

function Harness(props: { map: WorkMap; send: MapEditSend; onUndo?: (id: string) => Promise<string | null>; undoable?: ReturnType<typeof byApproveOf>['items'][number]; onNewLayer?: () => void }) {
  const mode = useAvanceMode(props.map, NO_FILTER);
  return (
    <>
      <button type="button" data-testid="mapa-modo-avance" onClick={mode.open} />
      {mode.on ? <AvanceTop mode={mode} title="Pachacamac" onNewLayer={props.onNewLayer ?? (() => undefined)} /> : null}
      <button type="button" data-testid="toque-calle" onClick={() => mode.tap(ON_STREET)} />
      <button type="button" data-testid="toque-fuera" onClick={() => mode.tap(OFF_STREET)} />
      {mode.target ? <AvancePanel map={props.map} target={mode.target} send={props.send} undoable={props.undoable ?? null} onUndo={props.onUndo} /> : null}
    </>
  );
}

const okSend = () => vi.fn<MapEditSend>(async () => ({ ok: true, message: MANUAL_SENT }));

describe('Modo Avance (web)', () => {
  it('shows the works with their percent and what to tap; a tap off the streets says so', () => {
    // Arrange
    render(<Harness map={MAP} send={okSend()} />);
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    // Assert
    expect(screen.getByTestId('avance-trabajo-imp')).toHaveTextContent('Imprimación 50 %');
    expect(screen.getByTestId('avance-trabajo-imp')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('avance-pista')).toHaveTextContent('Toca una calle para marcar su avance de Imprimación');
    // Act
    fireEvent.click(screen.getByTestId('toque-fuera'));
    // Assert
    expect(screen.getByTestId('avance-pista')).toHaveTextContent('Toca una calle de la obra en el mapa.');
    expect(screen.queryByTestId('avance-panel')).toBeNull();
  });

  it('a tap opens the street; 75 % sends the progress from where it stopped and says it waits for approval', async () => {
    // Arrange
    const send = okSend();
    render(<Harness map={MAP} send={send} />);
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    // Act
    fireEvent.click(screen.getByTestId('toque-calle'));
    fireEvent.click(screen.getByTestId('avance-pct-75'));
    fireEvent.click(screen.getByTestId('avance-guardar'));
    // Assert
    expect(screen.getByTestId('avance-panel')).toHaveTextContent('IMPRIMACIÓN · JR. LIMA');
    expect(screen.getByTestId('avance-panel')).toHaveTextContent('60 m de 120 m');
    await waitFor(() => expect(screen.getByTestId('avance-respuesta-modo')).toHaveTextContent(MANUAL_SENT));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'work_manual_progress', street_id: 's1', tag_id: 'imp', from_m: 60, to_m: 90 });
  });

  it('a percent at or below what is done is refused before sending', async () => {
    const send = okSend();
    render(<Harness map={MAP} send={send} />);
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    fireEvent.click(screen.getByTestId('toque-calle'));
    fireEvent.click(screen.getByTestId('avance-pct-25'));
    fireEvent.click(screen.getByTestId('avance-guardar'));
    await waitFor(() => expect(screen.getByTestId('avance-respuesta-modo')).toHaveTextContent('Esta calle ya va en 60 m de Imprimación.'));
    expect(send).not.toHaveBeenCalled();
  });

  it('another work without the street creates its stretch first; a typed chainage is the end; a resend keeps its ids', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async () => ({ ok: false, message: 'Sin señal.' }));
    render(<Harness map={MAP} send={send} />);
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    // Act
    fireEvent.click(screen.getByTestId('avance-trabajo-base'));
    fireEvent.click(screen.getByTestId('toque-calle'));
    fireEvent.click(screen.getByTestId('avance-progresiva'));
    fireEvent.change(screen.getByTestId('avance-progresiva-m'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('avance-guardar'));
    await waitFor(() => expect(screen.getByTestId('avance-respuesta-modo')).toHaveTextContent('Sin señal.'));
    fireEvent.click(screen.getByTestId('avance-guardar'));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    // Assert
    const [first, second] = send.mock.calls.map(([request]) => request);
    expect(first).toMatchObject({ kind: 'work_scope', scope_id: 'c1', tag_ids: ['imp', 'base'] });
    expect(second).toEqual(first);
  });

  it('without works it offers to create one', () => {
    render(<Harness map={{ ...MAP, works: [] }} send={okSend()} />);
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    expect(screen.getByTestId('avance-sin-trabajos')).toHaveTextContent('Aún no hay trabajos');
    expect(screen.getByTestId('trabajo-nueva')).toBeTruthy();
    expect(screen.queryByTestId('avance-pista')).toBeNull();
  });

  it('«+ Trabajo» and «Agregar trabajo» open «Nueva capa» (ma03)', () => {
    // Arrange
    const onNewLayer = vi.fn();
    render(<Harness map={MAP} send={okSend()} onNewLayer={onNewLayer} />);
    // Act
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    fireEvent.click(screen.getByTestId('avance-trabajo-nuevo'));
    // Assert
    expect(onNewLayer).toHaveBeenCalledTimes(1);
  });
});

/** José 28/11: the twin of a pending save is refused, and the author can undo it from the panel. */
describe('Modo Avance with what waits for approval (web)', () => {
  const list = byApproveOf({ avances: [{ avanceId: 'a9', estado: 'pendiente', calleId: 's1', desdeM: 60, hastaM: 90, tagId: 'imp', propio: true }] });
  const waiting = withPendingOf(MAP, list);

  it('the same 75 % again says it already waits and sends nothing', async () => {
    // Arrange
    const send = okSend();
    render(<Harness map={waiting} send={send} />);
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    // Act
    fireEvent.click(screen.getByTestId('toque-calle'));
    fireEvent.click(screen.getByTestId('avance-pct-75'));
    fireEvent.click(screen.getByTestId('avance-guardar'));
    // Assert
    expect(screen.getByTestId('avance-por-aprobar')).toHaveTextContent('Por aprobar hasta 0+090');
    await waitFor(() => expect(screen.getByTestId('avance-respuesta-modo')).toHaveTextContent('Ya hay un avance por aprobar hasta 0+090 en esta calle.'));
    expect(send).not.toHaveBeenCalled();
  });

  it('«Deshacer» on the own pending one asks and calls the undo', async () => {
    // Arrange
    const onUndo = vi.fn(async () => null);
    render(<Harness map={waiting} send={okSend()} undoable={list.items[0]} onUndo={onUndo} />);
    fireEvent.click(screen.getByTestId('mapa-modo-avance'));
    fireEvent.click(screen.getByTestId('toque-calle'));
    // Act
    fireEvent.click(screen.getByTestId('deshacer-avance-a9'));
    fireEvent.click(screen.getByTestId('deshacer-si-a9'));
    // Assert
    await waitFor(() => expect(onUndo).toHaveBeenCalledWith('a9'));
  });
});
