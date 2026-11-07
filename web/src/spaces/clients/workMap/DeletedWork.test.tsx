import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapEditSend, WorkMap } from '@lilachat/shared';
import { DeletedWork } from './DeletedWork';

/** «Borrados» for admins (José 07/11: «borrado lógico que el admin pueda restaurar»). */
const map: WorkMap = { streets: [{ id: 's1', name: 'Jr. Los Pinos', line: [], lengthM: 320 }], scopes: [], progress: [], works: [], stages: [] };
const data = {
  calles: [{ calleId: 's9', nombre: 'Jr. Las Flores', largoM: 280, borradoEl: '2026-11-07T15:20:00.000Z', borradoPor: 'Ana Ruiz' }],
  tramos: [{ tramoId: 'c7', calleId: 's1', desdeM: 120, hastaM: 191, borradoEl: '2026-11-07T20:53:00.000Z' }],
};

describe('DeletedWork', () => {
  it('lists what was deleted and restores one, then asks the list again', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async (request) => (request.kind === 'work_deleted' ? { ok: true, message: 'x', data } : { ok: true, message: 'Restaurado.' }));
    render(<DeletedWork map={map} send={send} onClose={vi.fn()} />);
    // Act
    expect(await screen.findByTestId('borrado-c7')).toHaveTextContent('Tramo 0+120 a 0+191');
    expect(screen.getByTestId('borrado-c7')).toHaveTextContent('Jr. Los Pinos · 71 m');
    expect(screen.getByTestId('borrado-s9')).toHaveTextContent('por Ana Ruiz');
    fireEvent.click(screen.getByTestId('restaurar-s9'));
    // Assert
    await waitFor(() => expect(send).toHaveBeenCalledWith({ kind: 'work_restore', street_id: 's9', forms: expect.any(Number) }, expect.any(Function)));
    await waitFor(() => expect(send.mock.calls.filter(([request]) => request.kind === 'work_deleted')).toHaveLength(2));
  });

  it('says when there is nothing, and shows Portal\'s refusal', async () => {
    const { unmount } = render(<DeletedWork map={map} send={async () => ({ ok: true, message: 'x', data: { calles: [], tramos: [] } })} onClose={vi.fn()} />);
    expect(await screen.findByText('No hay calles ni tramos borrados.')).toBeTruthy();
    unmount();
    render(<DeletedWork map={map} send={async () => ({ ok: false, message: 'Solo un admin con permiso de servicios.' })} onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo un admin con permiso de servicios.');
  });
});
