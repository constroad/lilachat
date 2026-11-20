import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommandGroup } from '@lilachat/shared';

const groups: CommandGroup[] = [{ appId: 'a1', appName: 'Inframaq', commands: [{ command: 'clima', description: 'Clima de la planta' }] }];
let releaseCommands: () => void = () => undefined;
const spaceCommands = vi.fn(() => new Promise((resolve) => { releaseCommands = () => resolve({ ok: true, data: { groups } }); }));
const runCommand = vi.fn(async () => ({ ok: true, data: { commandId: 'c1', appId: 'a1', appName: 'Inframaq', outcome: 'posted' } }));
const runAnswerCommand = vi.fn(async () => ({ ok: true, data: { commandId: 'c2', appId: 'a1', appName: 'Lila', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Ya tiene el enlace' } } }));
vi.mock('./commandsApi', () => ({ spaceCommands: (...args: unknown[]) => spaceCommands(...(args as [])), runCommand: (...args: unknown[]) => runCommand(...(args as [])), runAnswerCommand: (...args: unknown[]) => runAnswerCommand(...(args as [])), shareCommandAnswer: vi.fn() }));
const { useChatCommands, useChatCommandsWithActions } = await import('./useChatCommands');

describe('useChatCommands (23/10: a fast «/clima» + Enter went to the channel as text)', () => {
  it('José 05/11: the card runner keeps its identity between renders, or the conversation renders forever', () => {
    // Arrange
    const { result, rerender } = renderHook(() => useChatCommands({ jwt: 'jwt', chatId: 'ch1', workspaceId: 's1' }));
    const { runCardLine, runIfCommand } = result.current;
    // Act
    rerender();
    // Assert
    expect(result.current.runCardLine).toBe(runCardLine);
    expect(result.current.runIfCommand).toBe(runIfCommand);
  });

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

  it('once a row\'s line answers, the row\'s own panel has nothing left and closes (José 20/11: it stayed open after the card was already posted)', async () => {
    // Arrange: an existing «/lila» answer with its numbered-options card.
    const { result } = renderHook(() => useChatCommands({ jwt: 'jwt', chatId: 'ch1', workspaceId: 's1' }));
    await act(async () => void (await result.current.appAnswers.track({ appName: 'Lila', command: 'lila' }, async () => ({ ok: true, data: { commandId: 'c9', appId: 'a1', appName: 'Lila', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Elige una opción' } } }))));
    const existing = result.current.appAnswers.answers[0]!;
    // Act: tapping option 1 inside that card runs it as the app's row.
    let ok = false;
    await act(async () => { ok = await result.current.runAnswerLine(existing.commandId, '/lila 1'); });
    // Assert: the server got the line tied to that answer; the row's own panel is gone, the fresh answer stays.
    expect(ok).toBe(true);
    expect(runAnswerCommand).toHaveBeenCalledWith('jwt', 'ch1', { commandId: existing.commandId, line: '/lila 1' });
    expect(result.current.appAnswers.answers.some((answer) => answer.commandId === existing.commandId)).toBe(false);
    expect(result.current.appAnswers.answers).toMatchObject([{ commandId: 'c2', state: 'answered' }]);
  });
});

describe('the ⚡ of a chat (R31/10: the actions turned on for a chat had no place since the clip lost them)', () => {
  it('a channel or the chat with an app asks for its actions on open, once; the list has its actions and its commands', async () => {
    // Arrange
    spaceCommands.mockClear();
    const withActions: CommandGroup[] = [{ appId: 'a2', appName: 'Portal', commands: [{ command: 'tanques', description: 'Tanques' }], shortcuts: [{ key: 'registrar_consumo', name: 'Registrar consumo' }, { key: 'crear_cliente', name: 'Crear un cliente' }] }];
    spaceCommands.mockImplementationOnce(async () => ({ ok: true, data: { groups: withActions } }) as never);
    // Act
    const { result } = renderHook(() => useChatCommandsWithActions({ jwt: 'jwt', chatId: 'dm-app', workspaceId: 's1', actionPlace: true }));
    await act(async () => undefined);
    // Assert
    expect(spaceCommands).toHaveBeenCalledTimes(1);
    expect(spaceCommands).toHaveBeenCalledWith('jwt', 's1', { chatId: 'dm-app' });
    expect(result.current.actions.map((row) => row.key)).toEqual(['registrar_consumo', 'tanques']);
  });

  it('a person\'s chat asks nothing on open and has no actions', async () => {
    // Arrange
    spaceCommands.mockClear();
    // Act
    const { result } = renderHook(() => useChatCommandsWithActions({ jwt: 'jwt', chatId: 'dm-person', workspaceId: 's1', actionPlace: false }));
    await act(async () => undefined);
    // Assert
    expect(spaceCommands).not.toHaveBeenCalled();
    expect(result.current.actions).toEqual([]);
  });
});
