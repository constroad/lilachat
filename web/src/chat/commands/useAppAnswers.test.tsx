import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommandNotice, ShortcutRow } from '@lilachat/shared';

type Listener = (notice: CommandNotice) => void;
const listeners = new Set<Listener>();
const socket = { on: (_: string, listener: Listener) => listeners.add(listener), off: (_: string, listener: Listener) => listeners.delete(listener) };
let liveSocket: typeof socket | null = socket;
vi.mock('../../useSocket', () => ({ currentSocket: () => liveSocket }));
const runShortcut = vi.fn(async () => ({ ok: true, data: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'pending' } }));
vi.mock('./commandsApi', () => ({ runShortcut: (...args: unknown[]) => runShortcut(...(args as [])), previewAppForm: vi.fn(), refreshAppForm: vi.fn(), submitAppForm: vi.fn(), uploadFormPhoto: vi.fn() }));
const { useAppAnswers } = await import('./useAppAnswers');
const { announceSocketTurn } = await import('../../socketTurn');

const report: ShortcutRow = { kind: 'shortcut', appId: 'a1', appName: 'Portal', key: 'informe_de_servicio', name: 'Generar el informe de servicio' };
const space = { workspaceId: 'w1' };
const late: CommandNotice = { workspaceId: 'w1', commandId: 'c1', appId: 'a1', appName: 'Portal', response: { responseType: 'ephemeral', text: 'Tu informe está listo' } };

describe('a late answer in the space (01/11: the service report opened the ⚡ too)', () => {
  it('only the place that ran the action shows it; the ⚡ of the same space stays closed', async () => {
    // Arrange
    const button = renderHook(() => useAppAnswers({ jwt: 'jwt', scope: space }));
    const quickActions = renderHook(() => useAppAnswers({ jwt: 'jwt', scope: space }));
    await act(async () => void (await button.result.current.runAction(report, { servicioId: 's1' })));
    // Act
    act(() => listeners.forEach((listener) => listener(late)));
    // Assert
    expect(button.result.current.answers).toMatchObject([{ commandId: 'c1', state: 'answered' }]);
    expect(quickActions.result.current.answers).toEqual([]);
  });

  it('a place mounted before the socket still hears the late answer (06/11: the ⚡ said Portal did not answer)', async () => {
    // Arrange: the shell opens the socket in its own effect, which runs after those of its children.
    listeners.clear();
    liveSocket = null;
    const quickActions = renderHook(() => useAppAnswers({ jwt: 'jwt', scope: space }));
    await act(async () => void (await quickActions.result.current.runAction(report, { servicioId: 's1' })));
    // Act
    liveSocket = socket;
    act(() => announceSocketTurn());
    act(() => listeners.forEach((listener) => listener(late)));
    // Assert
    expect(quickActions.result.current.answers).toMatchObject([{ commandId: 'c1', state: 'answered' }]);
  });
});
