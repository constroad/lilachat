import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { ChatSummary } from '../types';
import type { WorkStage } from '@lilachat/shared';
import { PendingWeb, StageFilesWeb, TaskDetailWeb } from './WorkListsWeb';

/** Pending 21 (designs e2-17 and e2-18): «Pendientes», «Archivos» and a task's detail on the web. */
const channel: ChatSummary = { id: 'c9', kind: 'group', name: 'Constructora Vía Sur', workspaceId: 'w1', memberIds: ['yo'], lastSeq: 0, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat: channel, detalle: null, nombres: new Map([['u2', 'Ana Torres']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };
const withContext = (node: ReactNode) => render(<ConversacionContext.Provider value={context}>{node}</ConversacionContext.Provider>);
const photo = { seq: 12, kind: 'image' as const, url: 'https://x/media/12.jpg', name: 'probeta.jpg', sizeBytes: 2048, by: 'yo', at: '2026-10-23T15:14:00Z' };
const stages: WorkStage[] = [
  { _id: 's3', title: 'Ejecución', stage: 3, items: [{ id: 'a', text: 'Colocar carpeta', doneBy: null, doneAt: null, dueAt: '2099-01-01T00:00:00Z' }, { id: 'b', text: 'Control de densidad', doneBy: null, doneAt: null, assignee: 'u2', dueAt: '2026-10-23T00:00:00Z', addedBy: 'u2', evidence: [photo] }] },
];

afterEach(() => vi.unstubAllGlobals());

describe('the job tabs of a client channel on the web', () => {
  it('«Pendientes» lists the overdue task first and opens it', () => {
    const onOpen = vi.fn();
    withContext(<PendingWeb stages={stages} onOpen={onOpen} />);

    expect(screen.getByTestId('pendiente-0')).toHaveTextContent('Control de densidad');
    fireEvent.click(screen.getByTestId('pendiente-0'));
    expect(onOpen).toHaveBeenCalledWith({ stageId: 's3', itemId: 'b' });
  });

  it('«Archivos» groups the evidence by stage and goes to its message', () => {
    const onOpenMessage = vi.fn();
    withContext(<StageFilesWeb stages={stages} onOpenMessage={onOpenMessage} />);

    fireEvent.click(screen.getByTestId('archivo-de-obra-12'));
    expect(onOpenMessage).toHaveBeenCalledWith(12);
  });

  it('a plan without files says how to add them', () => {
    withContext(<StageFilesWeb stages={[{ ...stages[0]!, items: [] }]} onOpenMessage={vi.fn()} />);

    expect(screen.getByTestId('archivos-de-obra-vacio')).toHaveTextContent('Sin archivos todavía');
  });

  it('the detail shows who, overdue, evidence and activity, and «Marcar como hecho» ticks it', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();
    withContext(<TaskDetailWeb open={{ stageId: 's3', itemId: 'b' }} stages={stages} onChanged={onChanged} onOpenMessage={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('hoja-detalle-tarea')).toHaveTextContent('VENCIDO');
    expect(screen.getByTestId('hoja-detalle-tarea')).toHaveTextContent('Ana Torres');
    expect(screen.getByTestId('evidencia-foto-0')).toHaveTextContent('Foto 01');
    expect(screen.getByTestId('detalle-tarea-actividad')).toHaveTextContent('Ana Torres lo creó');
    fireEvent.click(screen.getByTestId('btn-tarea-marcar'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/agenda/checklists/s3/items/b/toggle');
  });
});
