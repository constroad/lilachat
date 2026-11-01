import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommandNotice, ShortcutRow } from '@lilachat/shared';

type Listener = (notice: CommandNotice) => void;
const listeners = new Set<Listener>();
const socket = { on: (_: string, listener: Listener) => listeners.add(listener), off: (_: string, listener: Listener) => listeners.delete(listener) };
vi.mock('../../useSocket', () => ({ currentSocket: () => socket }));
const runShortcut = vi.fn(async () => ({ ok: true, data: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'pending' } }));
vi.mock('./commandsApi', () => ({ runShortcut: (...args: unknown[]) => runShortcut(...(args as [])), previewAppForm: vi.fn(), refreshAppForm: vi.fn(), submitAppForm: vi.fn(), uploadFormPhoto: vi.fn() }));
const { useAppAnswers } = await import('./useAppAnswers');

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
});
