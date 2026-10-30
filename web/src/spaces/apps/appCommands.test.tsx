import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSchedules } from '@lilachat/shared';
import type { AppItems } from '../spacesApi';
import { AppCommandsPanel } from './AppCommandsPanel';

const api = vi.hoisted(() => ({ appItems: vi.fn(), saveAppItems: vi.fn(), spaceMembers: vi.fn(), appSchedules: vi.fn(), createAppSchedule: vi.fn(), setAppScheduleActive: vi.fn(), deleteAppSchedule: vi.fn() }));
vi.mock('../spacesApi', () => api);

/** «Comandos y acciones» v2 and «Horarios» (designs d-01, d-02, d-03; agentes COMANDOS-Y-HORARIOS, 28/10). */
const PLANTA = '6ad8b0cb30ce97957f4acc04';
const channels = [{ id: '6ad8b0cb30ce97957f4acc03', name: 'general', private: false }, { id: PLANTA, name: 'planta', private: false }];
const OFF = { global: false, channels: 'none' as const, direct: false, who: { kind: 'admins' as const } };
const items: AppItems = {
  canEdit: true,
  channels,
  items: [
    { kind: 'command', key: 'asistencia', name: '/asistencia', description: 'Asistencia del día', schedulable: true, ...OFF },
    { kind: 'command', key: 'planilla', name: '/planilla', description: 'Planilla de la semana', schedulable: true, shareable: false, ...OFF },
    { kind: 'shortcut', key: 'marcar', name: 'Marcar asistencia', ...OFF, global: true },
  ],
};
const members = [{ id: 'm1', userId: 'u-ana', name: 'Ana Torres', phone: '51987654321', role: 'member', status: 'active' }, { id: 'm2', userId: 'u-luis', name: 'Luis Huamán', phone: '51954321098', role: 'member', status: 'active' }];
const schedules: AppSchedules = {
  canEdit: true,
  schedules: [
    { id: 's1', command: 'asistencia', text: '', time: '10:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: false, active: true, where: { kind: 'channel', chatId: PLANTA, name: 'planta' }, createdBy: 'u-jose' },
    { id: 's2', command: 'clima', text: 'mañana', time: '17:00', repeat: { every: 1 }, onlyIfSomething: false, active: false, where: { kind: 'channel', chatId: 'c0', name: 'general' }, createdBy: 'u-jose', lastRun: { scheduledFor: '2026-10-27T22:00:00.000Z', at: '2026-10-27T22:15:00.000Z', outcome: 'failed', message: 'La app no respondió.' } },
  ],
  suggested: [{ command: 'asistencia', text: '', time: '18:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, onlyIfSomething: true }],
};

function arrange(overrides: { items?: AppItems; schedules?: AppSchedules } = {}) {
  api.appItems.mockResolvedValue({ ok: true, data: overrides.items ?? items });
  api.appSchedules.mockResolvedValue({ ok: true, data: overrides.schedules ?? schedules });
  api.spaceMembers.mockResolvedValue({ ok: true, data: { members } });
  render(<AppCommandsPanel jwt="jwt" spaceId="sp1" appId="a1" appName="Inframaq" />);
}

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe('«Comandos y acciones»: everything starts off, the admin turns on and picks who', () => {
  it('turns /asistencia on in the 1:1 and #planta for Ana; saves only that command', async () => {
    // Arrange
    arrange();
    api.saveAppItems.mockImplementation(async (_jwt, _space, _app, sent) => ({ ok: true, data: { ...items, items: items.items.map((row) => (row.key === 'asistencia' ? { ...row, ...sent['command:asistencia'] } : row)) } }));
    expect(await screen.findByTestId('estado-asistencia')).toHaveTextContent('Apagado');
    // Act
    fireEvent.click(screen.getByTestId('item-asistencia'));
    fireEvent.click(screen.getByTestId('directo-asistencia'));
    fireEvent.click(screen.getByTestId('canales-asistencia-some'));
    fireEvent.click(screen.getByTestId('canal-asistencia-planta'));
    fireEvent.click(screen.getByTestId('quien-asistencia-people'));
    fireEvent.click(screen.getByTestId('agregar-persona-asistencia'));
    fireEvent.click(await screen.findByTestId('elegir-persona-u-ana'));
    fireEvent.click(screen.getByTestId('guardar-asistencia'));
    // Assert
    await vi.waitFor(() => expect(api.saveAppItems).toHaveBeenCalledWith('jwt', 'sp1', 'a1', { 'command:asistencia': { global: false, channels: [PLANTA], direct: true, who: { kind: 'people', userIds: ['u-ana'] } } }));
    expect(await screen.findByTestId('estado-asistencia')).toHaveTextContent('Encendido');
    expect(screen.getByTestId('persona-asistencia-u-ana')).toHaveTextContent('Ana Torres');
  });

  it('a member sees what is on and where, without switches, saving or programming', async () => {
    arrange({ items: { ...items, canEdit: false }, schedules: { ...schedules, canEdit: false } });
    expect(await screen.findByTestId('estado-marcar')).toHaveTextContent('Encendido');
    fireEvent.click(screen.getByTestId('item-marcar'));
    expect(screen.getByTestId('global-marcar')).toBeDisabled();
    expect(screen.queryByTestId('guardar-marcar')).toBeNull();
    expect(screen.queryByTestId('programar-asistencia')).toBeNull();
    expect(await screen.findByTestId('horario-s1')).toBeInTheDocument();
    expect(screen.queryByTestId('crear-sugerido-0')).toBeNull();
  });

  it('«Crear un cliente» is turned on for the clients\' picker, not for the ⚡ (José 30/10)', async () => {
    arrange({ items: { ...items, items: [{ kind: 'shortcut', key: 'crear_cliente', name: 'Crear un cliente', ...OFF, global: true }] } });
    expect(await screen.findByTestId('item-crear_cliente')).toHaveTextContent('Funciona en el selector de clientes');
    fireEvent.click(screen.getByTestId('item-crear_cliente'));
    expect(screen.getByTestId('global-crear_cliente').closest('label') ?? screen.getByTestId('global-crear_cliente')).toHaveTextContent('Selector de clientes');
  });
});

describe('«Horarios»: what runs at a time and how the last run went', () => {
  it('lists each with its line, says why one did not run, and the switch pauses it', async () => {
    // Arrange
    arrange();
    api.setAppScheduleActive.mockResolvedValue({ ok: true, data: { ok: true } });
    // Act
    const row = await screen.findByTestId('horario-s1');
    fireEvent.click(screen.getByTestId('activo-s1'));
    // Assert
    expect(row).toHaveTextContent('10:30 · lunes a sábado · # planta');
    expect(screen.getByTestId('horario-error-s2')).toHaveTextContent('No corrió el 27/10: la app no respondió');
    await vi.waitFor(() => expect(api.setAppScheduleActive).toHaveBeenCalledWith('jwt', 'sp1', 'a1', 's1', false));
    expect(screen.getByTestId('activo-s1')).not.toBeChecked();
  });

  it('a suggestion opens «Programar» filled in; the admin picks the channel and it is created', async () => {
    // Arrange
    arrange();
    api.createAppSchedule.mockResolvedValue({ ok: true, data: { schedule: { ...schedules.schedules[0], id: 's3', time: '18:30', onlyIfSomething: true } } });
    // Act
    fireEvent.click(await screen.findByTestId('crear-sugerido-0'));
    const sheet = await screen.findByTestId('overlay');
    expect(within(sheet).getByTestId('programar-hora')).toHaveValue('18:30');
    expect(within(sheet).getByTestId('programar-solo-si-hay-algo')).toBeChecked();
    fireEvent.change(within(sheet).getByTestId('programar-donde'), { target: { value: PLANTA } });
    fireEvent.click(within(sheet).getByTestId('btn-programar'));
    // Assert
    await vi.waitFor(() => expect(api.createAppSchedule).toHaveBeenCalledWith('jwt', 'sp1', 'a1', { command: 'asistencia', text: '', time: '18:30', repeat: { weekdays: [1, 2, 3, 4, 5, 6] }, chat_id: PLANTA, only_if_something: true }));
    await vi.waitFor(() => expect(screen.queryByTestId('overlay')).toBeNull());
    expect(api.appSchedules).toHaveBeenCalledTimes(2);
  });

  it('a command with amounts is programmed only in the 1:1; no day picked asks for one; the server message shows', async () => {
    // Arrange
    arrange();
    api.createAppSchedule.mockResolvedValue({ ok: false, status: 409, message: 'Inframaq no está en #planta: agrégala en Ajustes.' });
    fireEvent.click(await screen.findByTestId('item-planilla'));
    // Act
    fireEvent.click(screen.getByTestId('programar-planilla'));
    const sheet = await screen.findByTestId('overlay');
    const places = within(sheet).getAllByRole('option').map((option) => (option as HTMLOptionElement).value);
    [1, 2, 3, 4, 5, 6, 0].forEach((day) => fireEvent.click(within(sheet).getByTestId(`dia-${day}`)));
    fireEvent.click(within(sheet).getByTestId('btn-programar'));
    const noDays = within(sheet).getByTestId('error-formulario').textContent;
    fireEvent.click(within(sheet).getByTestId('dia-1'));
    fireEvent.click(within(sheet).getByTestId('btn-programar'));
    // Assert
    expect(places).toEqual(['direct']);
    expect(noDays).toMatch(/Elige los días/);
    expect(await within(sheet).findByText('Inframaq no está en #planta: agrégala en Ajustes.')).toBeInTheDocument();
    expect(api.createAppSchedule).toHaveBeenCalledWith('jwt', 'sp1', 'a1', expect.objectContaining({ command: 'planilla', chat_id: 'direct', repeat: { weekdays: [1] } }));
  });
});
