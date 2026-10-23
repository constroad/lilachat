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
    expect(await result.current.runIfCommand('/otra')).toBe('not-command');
    expect(await result.current.runIfCommand('hola')).toBe('not-command');
  });
});
