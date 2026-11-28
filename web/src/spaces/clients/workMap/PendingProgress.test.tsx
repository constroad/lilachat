import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { byApproveOf, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { PendingProgressCard } from './PendingProgress';

/** José 09/11: the progress sent «disappeared»; it now waits above the map, and an admin approves it there. */
const data = { total: 1, verTodos: true, pendientes: [{ avanceId: 'a1', fecha: '2026-11-09', calleId: 's1', calle: 'Jr. Moquegua', desdeM: 0, hastaM: 30, metrado: 180, trabajo: 'Asfalto QA', unidades: 0, fotos: 1, registradoPor: 'Ana Ruiz' }] };

function sender(list: unknown) {
  const calls: string[] = [];
  const send = vi.fn(async (request: { kind: string }) => {
    calls.push(request.kind);
    return request.kind === 'work_pending' ? { ok: true as const, message: '', data: list as Record<string, unknown> } : { ok: true as const, message: 'Listo.' };
  });
  return { send: send as unknown as MapEditSend, calls, spy: send };
}

describe('«Por aprobar» above the work map', () => {
  it('an admin sees each pending progress and approves it there; the list asks again', async () => {
    // Arrange
    const { send, calls, spy } = sender(data);
    render(<PendingProgressCard send={send} admin reloadKey={1} />);
    // Act
    fireEvent.click(await screen.findByTestId('aprobar-avance-a1'));
    // Assert
    expect(screen.getByTestId('avances-por-aprobar')).toHaveTextContent('1 avance por aprobar');
    expect(screen.getByTestId('avance-pendiente-a1')).toHaveTextContent('Jr. Moquegua · 0+000 a 0+030 · Asfalto QA · 9 nov · por Ana Ruiz');
    await waitFor(() => expect(calls).toEqual(['work_pending', 'work_resolve', 'work_pending']));
    expect(spy.mock.calls[1]![0]).toMatchObject({ kind: 'work_resolve', progress_id: 'a1', decision: 'aprobar' });
  });

  it('a member sees what waits, with no buttons, and why', async () => {
    const { send } = sender({ ...data, verTodos: false });
    render(<PendingProgressCard send={send} admin={false} reloadKey={1} />);
    expect(await screen.findByTestId('avance-pendiente-a1')).toBeInTheDocument();
    expect(screen.queryByTestId('aprobar-avance-a1')).toBeNull();
    expect(screen.getByTestId('avances-por-aprobar')).toHaveTextContent('espera la aprobación del residente');
  });

  it('with nothing pending, nothing is drawn', async () => {
    const { send, calls } = sender({ total: 0, verTodos: true, pendientes: [] });
    const { container } = render(<PendingProgressCard send={send} admin reloadKey={1} />);
    await waitFor(() => expect(calls).toEqual(['work_pending']));
    expect(container).toBeEmptyDOMElement();
  });
  it('tells the board what waits, so the map draws it over its street; empty when it fails', async () => {
    // Arrange
    const onList = vi.fn();
    const { send } = sender(data);
    const failing = vi.fn(async () => { throw new Error('offline'); }) as unknown as MapEditSend;
    // Act
    render(<PendingProgressCard send={send} admin reloadKey={1} onList={onList} />);
    render(<PendingProgressCard send={failing} admin reloadKey={1} onList={onList} />);
    // Assert
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    expect(onList).toHaveBeenCalledWith([expect.objectContaining({ id: 'a1', streetId: 's1', fromM: 0, toM: 30 })]);
    expect(onList).toHaveBeenCalledWith([]);
  });
});

/** José 28/11: «POR APROBAR» and «RECHAZADO» pills, and «Deshacer» on the caller's own pending progress. */
describe('what waits and what was rejected, with undo', () => {
  const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }];
  const MAP: WorkMap = { streets: [{ id: 's1', name: 'Jr. Moquegua', line, lengthM: 120 }], scopes: [], progress: [], works: [{ id: 'asf', name: 'Asfalto QA', color: '#111827' }], stages: [] };
  const byApprove = byApproveOf({ total: 2, avances: [
    { avanceId: 'a1', estado: 'pendiente', fecha: '2026-11-28', calleId: 's1', desdeM: 0, hastaM: 30, tagId: 'asf', metrado: 30, autor: 'Ana Ruiz', propio: true },
    { avanceId: 'r1', estado: 'rechazado', fecha: '2026-11-27', calleId: 's1', desdeM: 30, hastaM: 60, tagId: 'asf', metrado: 30, autor: 'Ana Ruiz', propio: true, notaRechazo: 'Mal medido' },
  ] });

  it('pills each row and shows the rejected one with its note', async () => {
    // Arrange
    const { send } = sender(data);
    // Act
    render(<PendingProgressCard send={send} admin={false} reloadKey={1} byApprove={{ list: byApprove, map: MAP, onUndo: vi.fn() }} />);
    // Assert
    expect(await screen.findByTestId('avance-pendiente-a1')).toHaveTextContent('POR APROBAR');
    expect(screen.getByTestId('avance-rechazado-r1')).toHaveTextContent('RECHAZADO');
    expect(screen.getByTestId('avance-rechazado-r1')).toHaveTextContent('Mal medido');
    expect(screen.getByTestId('avance-rechazado-r1')).toHaveTextContent('Jr. Moquegua · 0+030 a 0+060 · Asfalto QA');
  });

  it('«Deshacer» asks first, then undoes; Portal\'s refusal is shown', async () => {
    // Arrange
    const { send } = sender(data);
    const onUndo = vi.fn(async () => 'Ya fue aprobado.');
    render(<PendingProgressCard send={send} admin={false} reloadKey={1} byApprove={{ list: byApprove, map: MAP, onUndo }} />);
    // Act
    fireEvent.click(await screen.findByTestId('deshacer-avance-a1'));
    // Assert
    expect(screen.getByTestId('avance-pendiente-a1')).toHaveTextContent('¿Deshacer el avance hasta 0+030? Se borra antes de que lo aprueben.');
    expect(onUndo).not.toHaveBeenCalled();
    // Act
    fireEvent.click(screen.getByTestId('deshacer-si-a1'));
    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ya fue aprobado.'));
    expect(onUndo).toHaveBeenCalledWith('a1');
  });

  it('shows only the rejected ones when nothing waits', async () => {
    const { send } = sender({ total: 0, verTodos: false, pendientes: [] });
    render(<PendingProgressCard send={send} admin={false} reloadKey={1} byApprove={{ list: { total: 1, items: byApprove.items.slice(1) }, map: MAP, onUndo: vi.fn() }} />);
    expect(await screen.findByTestId('avance-rechazado-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('deshacer-avance-a1')).toBeNull();
  });
});
