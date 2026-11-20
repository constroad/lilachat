import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { WorkStage } from '@lilachat/shared';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { ChatSummary } from '../types';
import { PendingWeb } from './WorkListsWeb';
import { attachEvidenceWeb, toggleTaskWeb } from './evidenceWeb';

vi.mock('./evidenceWeb', () => ({ attachEvidenceWeb: vi.fn(async () => null), detachEvidenceWeb: vi.fn(async () => null), toggleTaskWeb: vi.fn(async () => null) }));

/** José 19/11, design cc-06: each pending row has its box to tick and its camera, as the plan's permissions allow. */
const channel: ChatSummary = { id: 'c9', kind: 'group', name: 'Constructora Vía Sur', workspaceId: 'w1', memberIds: ['yo'], lastSeq: 0, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat: channel, detalle: null, nombres: new Map([['u2', 'Ana Torres']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };
const withContext = (node: ReactNode) => render(<ConversacionContext.Provider value={context}>{node}</ConversacionContext.Provider>);
const stages: WorkStage[] = [
  { _id: 's1', title: 'Inicio', stage: 1, items: [{ id: 'mine', text: 'Firmar acta de inicio', doneBy: null, doneAt: null, assignee: 'yo', dueAt: '2099-01-01T00:00:00Z' }, { id: 'hers', text: 'Enviar plano de parches', doneBy: null, doneAt: null, assignee: 'u2', dueAt: '2099-01-02T00:00:00Z' }] },
];

afterEach(() => vi.clearAllMocks());

describe('the pending rows (design cc-06)', () => {
  it('a member who is not admin ticks and photographs only their own task', () => {
    withContext(<PendingWeb stages={stages} admin={false} onOpen={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByTestId('pendiente-marcar-mine')).toBeInTheDocument();
    expect(screen.getByTestId('pendiente-camara-mine')).toBeInTheDocument();
    expect(screen.queryByTestId('pendiente-marcar-hers')).toBeNull();
    expect(screen.queryByTestId('pendiente-camara-hers')).toBeNull();
  });

  it('the admin has both on every row', () => {
    withContext(<PendingWeb stages={stages} admin onOpen={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByTestId('pendiente-marcar-hers')).toBeInTheDocument();
    expect(screen.getByTestId('pendiente-camara-hers')).toBeInTheDocument();
  });

  it('the box ticks the task without opening its detail and reloads the plan', async () => {
    // Arrange
    const onOpen = vi.fn();
    const onChanged = vi.fn();
    withContext(<PendingWeb stages={stages} admin={false} onOpen={onOpen} onChanged={onChanged} />);
    // Act
    fireEvent.click(screen.getByTestId('pendiente-marcar-mine'));
    // Assert
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(toggleTaskWeb).toHaveBeenCalledWith({ jwt: 'j', checklistId: 's1', itemId: 'mine' });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('the camera uploads the photo as the task\'s evidence through the same door as the detail', async () => {
    // Arrange
    const onChanged = vi.fn();
    withContext(<PendingWeb stages={stages} admin={false} onOpen={vi.fn()} onChanged={onChanged} />);
    const photo = new File(['x'], 'acta.jpg', { type: 'image/jpeg' });
    // Act
    fireEvent.change(screen.getByTestId('pendiente-foto-mine'), { target: { files: [photo] } });
    // Assert
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(attachEvidenceWeb).toHaveBeenCalledWith({ jwt: 'j', chatId: 'c9', checklistId: 's1', itemId: 'mine', taskText: 'Firmar acta de inicio', file: photo });
  });

  it('a failure is said on the row', async () => {
    vi.mocked(toggleTaskWeb).mockResolvedValueOnce('No se pudo marcar la tarea.');
    withContext(<PendingWeb stages={stages} admin={false} onOpen={vi.fn()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pendiente-marcar-mine'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo marcar la tarea.');
  });
});
