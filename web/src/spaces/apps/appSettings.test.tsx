import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppItems, AppTopics } from '../spacesApi';
import { AppItemsSection } from './AppItemsSection';
import { NoticeTopicsSection } from './NoticeTopicsSection';

const api = vi.hoisted(() => ({ appItems: vi.fn(), saveAppItems: vi.fn(), appTopics: vi.fn(), saveAppTopics: vi.fn(), testAppTopics: vi.fn() }));
vi.mock('../spacesApi', () => api);

const channels = [{ id: 'ch1', name: 'general', private: false }, { id: 'ch2', name: 'planta', private: false }];
const items: AppItems = {
  canEdit: true,
  channels,
  items: [
    { kind: 'shortcut', key: 'marcar_asistencia', name: 'Marcar asistencia', global: true, channels: 'all' },
    { kind: 'command', key: 'clima', name: '/clima', description: 'Clima de la planta', global: false, channels: 'all' },
  ],
};
const topics: AppTopics = { canEdit: true, channels, topics: [{ key: 'asistencia', name: 'Asistencia', description: 'Ingresos, refrigerio y salida', icon: 'attendance', channel: { id: 'ch1', name: 'general' } }] };

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe('«Comandos y acciones» (José, 23/10: only some are global)', () => {
  it('the admin puts /clima in the ⚡ and the action only in #planta; only what changed is saved', async () => {
    // Arrange
    api.appItems.mockResolvedValue({ ok: true, data: items });
    api.saveAppItems.mockResolvedValue({ ok: true, data: items });
    render(<AppItemsSection jwt="jwt" spaceId="s1" appId="a1" />);
    await screen.findByTestId('comandos-y-acciones');
    // Act
    fireEvent.click(screen.getByTestId('global-clima'));
    fireEvent.change(screen.getByTestId('canales-marcar_asistencia'), { target: { value: 'some' } });
    fireEvent.click(screen.getByTestId('canal-marcar_asistencia-planta'));
    fireEvent.click(screen.getByTestId('btn-guardar-items'));
    // Assert
    await vi.waitFor(() => expect(api.saveAppItems).toHaveBeenCalledWith('jwt', 's1', 'a1', { 'shortcut:marcar_asistencia': { global: true, channels: ['ch2'] }, 'command:clima': { global: true, channels: 'all' } }));
    expect(await screen.findByText('Guardado. Ya se ve así en el espacio.')).toBeInTheDocument();
  });

  it('a member sees where each works, without switches to save', async () => {
    api.appItems.mockResolvedValue({ ok: true, data: { ...items, canEdit: false } });
    render(<AppItemsSection jwt="jwt" spaceId="s1" appId="a1" />);
    expect(await screen.findByTestId('global-clima')).toBeDisabled();
    expect(screen.queryByTestId('btn-guardar-items')).toBeNull();
  });
});

describe('«¿Dónde llega cada aviso?» (design e-31)', () => {
  it('the admin moves Asistencia to #planta, or leaves it without a channel; «Probar envío» says where it went', async () => {
    // Arrange
    api.appTopics.mockResolvedValue({ ok: true, data: topics });
    api.saveAppTopics.mockResolvedValue({ ok: true, data: topics });
    api.testAppTopics.mockResolvedValue({ ok: true, data: { channels: 1 } });
    render(<NoticeTopicsSection jwt="jwt" spaceId="s1" appId="a1" appName="Inframaq" />);
    await screen.findByTestId('avisos-de-la-app');
    // Act
    fireEvent.change(screen.getByTestId('canal-tema-asistencia'), { target: { value: 'ch2' } });
    fireEvent.click(screen.getByTestId('btn-guardar-avisos'));
    await vi.waitFor(() => expect(api.saveAppTopics).toHaveBeenCalledWith('jwt', 's1', 'a1', { asistencia: 'ch2' }));
    await screen.findByText('Guardado. Los próximos avisos llegan a esos canales.');
    fireEvent.click(screen.getByTestId('btn-probar-avisos'));
    // Assert
    expect(await screen.findByText('Se mandó una prueba a 1 canal.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('canal-tema-asistencia'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('btn-guardar-avisos'));
    await vi.waitFor(() => expect(api.saveAppTopics).toHaveBeenLastCalledWith('jwt', 's1', 'a1', { asistencia: null }));
  });

  it('a payroll topic without a default asks for a private channel, and warns on a public one (agentes, 24/10)', async () => {
    // Arrange
    const withPrivate = [...channels, { id: 'ch3', name: 'gerencia', private: true }];
    api.appTopics.mockResolvedValue({ ok: true, data: { canEdit: true, channels: withPrivate, topics: [{ key: 'planilla', name: 'Planilla', icon: 'cash', noDefault: true, channel: null }] } });
    render(<NoticeTopicsSection jwt="jwt" spaceId="s1" appId="a1" appName="Inframaq" />);
    // Act
    const waiting = await screen.findByTestId('aviso-privado-planilla');
    // Assert
    expect(waiting).toHaveTextContent('Datos sensibles: elige un canal privado');
    fireEvent.change(screen.getByTestId('canal-tema-planilla'), { target: { value: 'ch1' } });
    expect(screen.getByTestId('aviso-privado-planilla')).toHaveTextContent('Es un canal abierto: mejor uno privado');
    fireEvent.change(screen.getByTestId('canal-tema-planilla'), { target: { value: 'ch3' } });
    expect(screen.queryByTestId('aviso-privado-planilla')).toBeNull();
  });

  it('an app without topics draws nothing', async () => {
    api.appTopics.mockResolvedValue({ ok: true, data: { ...topics, topics: [] } });
    const { container } = render(<NoticeTopicsSection jwt="jwt" spaceId="s1" appId="a1" appName="Inframaq" />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
