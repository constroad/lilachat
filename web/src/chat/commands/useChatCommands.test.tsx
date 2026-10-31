import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommandGroup } from '@lilachat/shared';

const groups: CommandGroup[] = [{ appId: 'a1', appName: 'Inframaq', commands: [{ command: 'clima', description: 'Clima de la planta' }] }];
let releaseCommands: () => void = () => undefined;
const spaceCommands = vi.fn(() => new Promise((resolve) => { releaseCommands = () => resolve({ ok: true, data: { groups } }); }));
const runCommand = vi.fn(async () => ({ ok: true, data: { commandId: 'c1', appId: 'a1', appName: 'Inframaq', outcome: 'posted' } }));
vi.mock('./commandsApi', () => ({ spaceCommands: (...args: unknown[]) => spaceCommands(...(args as [])), runCommand: (...args: unknown[]) => runCommand(...(args as [])), shareCommandAnswer: vi.fn() }));
const { useChatCommands } = await import('./useChatCommands');

describe('useChatCommands (23/10: a fast «/clima» + Enter went to the channel as text)', () => {
  it('a command sent before the space\'s commands arrive waits for them and goes to its app; asked once', async () => {
    // Arrange
    const { result } = renderHook(() => useChatCommands({ jwt: 'jwt', chatId: 'ch1', workspaceId: 's1' }));
    act(() => result.current.onType('/'));
    // Act
    let outcome: Promise<boolean | 'not-command'> = Promise.resolve(false);
    act(() => { outcome = result.current.runIfCommand('/clima lurín'); });
    await act(async () => releaseCommands());
    // Assert
    expect(await outcome).toBe(true);
    expect(spaceCommands).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith('jwt', 'ch1', { appId: 'a1', command: 'clima', text: 'lurín' });
    // A command no app has is not sent as text: it says so (pending 102).
    expect(await result.current.runIfCommand('/otra')).toBe(true);
    expect(await result.current.runIfCommand('hola')).toBe('not-command');
  });
});

describe('the ⚡ of a chat (R31/10: the actions turned on for a chat had no place since the clip lost them)', () => {
  it('a channel or the chat with an app asks for its actions on open, once; only the actions are listed', async () => {
    // Arrange
    spaceCommands.mockClear();
    const withActions: CommandGroup[] = [{ appId: 'a2', appName: 'Portal', commands: [{ command: 'tanques', description: 'Tanques' }], shortcuts: [{ key: 'registrar_consumo', name: 'Registrar consumo' }, { key: 'crear_cliente', name: 'Crear un cliente' }] }];
    spaceCommands.mockImplementationOnce(async () => ({ ok: true, data: { groups: withActions } }) as never);
    // Act
    const { result } = renderHook(() => useChatCommands({ jwt: 'jwt', chatId: 'dm-app', workspaceId: 's1', actionPlace: true }));
    await act(async () => undefined);
    // Assert
    expect(spaceCommands).toHaveBeenCalledTimes(1);
    expect(spaceCommands).toHaveBeenCalledWith('jwt', 's1', { chatId: 'dm-app' });
    expect(result.current.actions.map((row) => row.key)).toEqual(['registrar_consumo']);
  });

  it('a person\'s chat asks nothing on open and has no actions', async () => {
    // Arrange
    spaceCommands.mockClear();
    // Act
    const { result } = renderHook(() => useChatCommands({ jwt: 'jwt', chatId: 'dm-person', workspaceId: 's1' }));
    await act(async () => undefined);
    // Assert
    expect(spaceCommands).not.toHaveBeenCalled();
    expect(result.current.actions).toEqual([]);
  });
});
