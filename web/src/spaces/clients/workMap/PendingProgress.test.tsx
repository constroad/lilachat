import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MapEditSend } from '@lilachat/shared';
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
});
