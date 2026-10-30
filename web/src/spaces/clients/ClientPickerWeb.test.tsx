import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientEntry, SpaceClient } from '@lilachat/shared';
import type { ChatSummary } from '../../chat/types';
import { ClientPickerWeb } from './ClientPickerWeb';

const api = vi.hoisted(() => ({ spaceCommands: vi.fn() }));
vi.mock('../../chat/commands/commandsApi', () => api);
const answers = vi.hoisted(() => ({ answers: [], openForm: null, runAction: vi.fn(), dismiss: vi.fn(), showForm: vi.fn(), submitForm: vi.fn(), uploadPhoto: vi.fn() }));
vi.mock('../../chat/commands/useAppAnswers', () => ({ useAppAnswers: () => answers }));

/** José 30/10: «que sea tipo un selector y una opción de poder crear un cliente», and creating is not in the ⚡. */
const now = new Date('2026-10-30T15:00:00Z');
const client = (id: string, name: string, ruc?: string): SpaceClient => ({ id, chat_id: `chat-${id}`, name, ruc, live: true, archived_since: null, last_activity_at: now.toISOString(), last_order_at: null, orders_total: 0, archived_group: '2-6', services: [] });
const entry = (one: SpaceClient): ClientEntry<ChatSummary> => ({ client: one, chat: { id: one.chat_id, kind: 'group', name: one.name, unread: 0, lastSeq: 0, memberIds: [] } as unknown as ChatSummary });
const live = [entry(client('a', 'CARCELI SAC', '20512345678')), entry(client('b', 'Obras Chancay')), entry(client('c', 'Asfaltos del Sur')), entry(client('d', 'Vial Norte')), entry(client('e', 'Pavimentos Lima'))];
const portal = (shortcuts: { key: string; name: string }[]) => ({ ok: true, data: { groups: [{ appId: 'p', appName: 'Portal', commands: [], shortcuts }] } });

function arrange(shortcuts: { key: string; name: string }[]) {
  api.spaceCommands.mockResolvedValue(portal(shortcuts));
  const onOpen = vi.fn();
  render(<ClientPickerWeb jwt="jwt" spaceId="sp1" live={live} archived={3} onOpen={onOpen} onArchived={vi.fn()} now={now} />);
  fireEvent.click(screen.getByTestId('selector-clientes'));
  return { onOpen };
}

beforeEach(() => {
  api.spaceCommands.mockReset();
  answers.runAction.mockReset();
});

describe('ClientPickerWeb', () => {
  it('lists every live client, searches by name or RUC and opens the one picked', async () => {
    // Arrange
    const { onOpen } = arrange([]);
    const list = screen.getByTestId('lista-selector-clientes');
    expect(within(list).getAllByTestId(/^cliente-fila-/)).toHaveLength(5);
    // Act
    fireEvent.change(screen.getByTestId('buscar-cliente'), { target: { value: '2051234' } });
    fireEvent.click(within(list).getByTestId('cliente-fila-a'));
    // Assert
    expect(onOpen).toHaveBeenCalledWith(live[0]!.chat);
    expect(screen.queryByTestId('lista-selector-clientes')).toBeNull();
  });

  it('«Crear un cliente» shows when Portal\'s action is on for that person and runs it from the picker', async () => {
    arrange([{ key: 'crear_cliente', name: 'Crear un cliente' }]);
    fireEvent.click(await screen.findByTestId('crear-cliente'));
    expect(answers.runAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'crear_cliente', appName: 'Portal' }));
    expect(api.spaceCommands).toHaveBeenCalledWith('jwt', 'sp1', 'space');
  });

  it('without the action (off, or not allowed) there is no create button, only the list', async () => {
    arrange([{ key: 'crear_pedido', name: 'Crear un pedido' }]);
    await vi.waitFor(() => expect(api.spaceCommands).toHaveBeenCalled());
    expect(screen.queryByTestId('crear-cliente')).toBeNull();
    expect(screen.queryByText('Ningún cliente con ese nombre o RUC.')).toBeNull();
  });
});
