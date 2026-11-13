import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CardContext, CommandNotice, CommandOutcome, ShortcutRow } from '@lilachat/shared';

type Listener = (notice: CommandNotice) => void;
const listeners = new Set<Listener>();
const socket = { on: (_: string, listener: Listener) => listeners.add(listener), off: (_: string, listener: Listener) => listeners.delete(listener) };
let liveSocket: typeof socket | null = socket;
vi.mock('../../useSocket', () => ({ currentSocket: () => liveSocket }));
const runShortcut = vi.fn(async () => ({ ok: true, data: { commandId: 'c1', appId: 'a1', appName: 'Portal', outcome: 'pending' } }));
const submitAppForm = vi.fn();
vi.mock('./commandsApi', () => ({ runShortcut: (...args: unknown[]) => runShortcut(...(args as [])), previewAppForm: vi.fn(), refreshAppForm: vi.fn(), submitAppForm: (...args: unknown[]) => submitAppForm(...args), uploadFormPhoto: vi.fn() }));
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

describe('the card a form was opened from (design gst-02: the voucher stays above the form)', () => {
  const voucher: CardContext = { kicker: 'Gasto', figure: 'S/ 500.00', title: 'Ferretería El Constructor', fields: [{ label: 'Medio', value: 'Yape' }] };
  const form = { id: 'completar', title: 'Completar gasto', schema: { type: 'object', properties: {} } };
  const formOutcome = (commandId: string): CommandOutcome => ({ commandId, appId: 'a1', appName: 'Portal', outcome: 'form', response: { responseType: 'ephemeral', form } } as unknown as CommandOutcome);

  it('the form that the card\'s button opens carries that card', async () => {
    // Arrange
    const hook = renderHook(() => useAppAnswers({ jwt: 'jwt', scope: { chatId: 'c1' } }));
    // Act
    await act(async () => void (await hook.result.current.track({ appName: 'La app', command: 'gastos', context: voucher }, async () => ({ ok: true, data: formOutcome('f1') }))));
    // Assert
    expect(hook.result.current.openForm).toMatchObject({ commandId: 'f1', state: 'form', context: voucher });
  });

  it('a form opened from a button with no card carries none', async () => {
    const hook = renderHook(() => useAppAnswers({ jwt: 'jwt', scope: { chatId: 'c1' } }));
    await act(async () => void (await hook.result.current.track({ appName: 'La app', command: 'gastos' }, async () => ({ ok: true, data: formOutcome('f2') }))));
    expect(hook.result.current.openForm?.context).toBeUndefined();
  });

  it('the next form the app asks for (after the destination) keeps the card', async () => {
    // Arrange
    const hook = renderHook(() => useAppAnswers({ jwt: 'jwt', scope: { chatId: 'c1' } }));
    await act(async () => void (await hook.result.current.track({ appName: 'La app', command: 'gastos', context: voucher }, async () => ({ ok: true, data: formOutcome('f3') }))));
    submitAppForm.mockResolvedValueOnce({ ok: true, outcome: formOutcome('f4') });
    // Act
    await act(async () => void (await hook.result.current.submitForm(hook.result.current.openForm!, {})));
    // Assert
    expect(hook.result.current.openForm).toMatchObject({ commandId: 'f4', context: voucher });
  });
});
