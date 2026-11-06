import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShortcutRow } from '@lilachat/shared';
import { ChatQuickActions } from './ChatQuickActions';
import type { ChatCommands } from './useChatCommands';

const consumo: ShortcutRow = { kind: 'shortcut', appId: 'a2', appName: 'Portal', key: 'registrar_consumo', name: 'Registrar consumo' };
const commandsWith = (actions: ShortcutRow[], runAction = vi.fn()) => ({ actions, appAnswers: { runAction } }) as unknown as ChatCommands;

/** The ⚡ of a chat (R31/10): the actions an admin turned on for a channel or the chat with the app. */
describe('ChatQuickActions', () => {
  it('a chat with no actions shows no ⚡', () => {
    // Arrange / Act
    render(<ChatQuickActions commands={commandsWith([])} onWriteCommand={vi.fn()} />);
    // Assert
    expect(screen.queryByTestId('btn-acciones-chat')).not.toBeInTheDocument();
  });

  it('picking an action closes the list and runs it in the chat', () => {
    // Arrange
    const runAction = vi.fn();
    render(<ChatQuickActions commands={commandsWith([consumo], runAction)} onWriteCommand={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-acciones-chat'));
    fireEvent.click(screen.getByTestId('accion-chat-registrar_consumo'));
    // Assert
    expect(runAction).toHaveBeenCalledWith(consumo);
    expect(screen.queryByTestId('hoja-acciones-chat')).not.toBeInTheDocument();
  });

  it('a command that needs its text goes to the field instead of running', () => {
    // Arrange
    const runAction = vi.fn();
    const onWriteCommand = vi.fn();
    const ordersCommand: ShortcutRow = { kind: 'command', appId: 'a2', appName: 'Portal', key: 'pedidos', name: '/pedidos', usageHint: '[cliente]' };
    render(<ChatQuickActions commands={commandsWith([ordersCommand], runAction)} onWriteCommand={onWriteCommand} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-acciones-chat'));
    fireEvent.click(screen.getByTestId('accion-chat-pedidos'));
    // Assert
    expect(onWriteCommand).toHaveBeenCalledWith('/pedidos ');
    expect(runAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId('hoja-acciones-chat')).not.toBeInTheDocument();
  });

  it('a command without text runs from the list, like an action', () => {
    // Arrange
    const runAction = vi.fn();
    const clima: ShortcutRow = { kind: 'command', appId: 'a2', appName: 'Portal', key: 'clima', name: '/clima' };
    render(<ChatQuickActions commands={commandsWith([clima], runAction)} onWriteCommand={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-acciones-chat'));
    fireEvent.click(screen.getByTestId('accion-chat-clima'));
    // Assert
    expect(runAction).toHaveBeenCalledWith(clima);
  });
});
