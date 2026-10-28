import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClientWorkspace, DirectoryApp } from '@lilachat/shared';
import type { ChatSummary } from '../../chat/types';
import { AppDirectory } from './AppDirectory';
import { AppsSection } from './AppsSection';
import { AppCommandsBar, AppConversationHeader } from './AppConversation';
import { AppLogo } from './AppLogo';
import type { SpaceApps } from './useSpaceApps';

const installation = { installationId: 'i1', botUserId: 'bot1', installedBy: 'José Zamora', installedAt: '2026-10-23T15:00:00Z', channels: 3, directs: 12 };
const inframaq: DirectoryApp = { appId: 'a1', clientId: 'lca_inframaq', name: 'Inframaq', description: 'Clima, asistencias y tanques de la planta', features: ['El clima de la planta'], developer: 'Agentes ConstRoad', category: 'operacion', commands: [{ command: 'clima', description: 'Clima de hoy', usageHint: '[mañana]' }], installation };
const pulso: DirectoryApp = { appId: 'a2', clientId: 'lca_pulso', name: 'Pulso', description: 'Asistencia del personal', features: [], category: 'personas', commands: [], installUrl: 'https://agentes.example.com/install?app=pulso&space=s1' };
const space = { id: 's1', name: 'INFRAMAQ' } as ClientWorkspace;

const appsOf = (overrides: Partial<SpaceApps> = {}): SpaceApps => ({
  directory: { apps: [inframaq, pulso], canInstall: true },
  open: { appId: null },
  openDirectory: vi.fn(),
  closeDirectory: vi.fn(),
  message: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  openedChats: {},
  uninstallingId: null,
  refresh: vi.fn(),
  jwt: 'jwt',
  spaceId: null,
  ...overrides,
});

describe('AppDirectory (design e-24)', () => {
  it('lists with chips and search; the detail has «Mensaje» for an installed app and «Instalar en» for one that is not', () => {
    // Arrange
    const apps = appsOf();
    render(<AppDirectory space={space} apps={apps} />);
    // Act
    const activity = screen.getByText('Activa en 3 canales y 12 mensajes directos', { exact: false });
    fireEvent.click(screen.getByTestId('app-mensaje'));
    fireEvent.click(screen.getByTestId('fila-app-a2'));
    fireEvent.click(screen.getByTestId('app-instalar'));
    // Assert
    expect(screen.getByText('Instaladas (1)')).toBeInTheDocument();
    expect(activity).toBeTruthy();
    expect(apps.message).toHaveBeenCalledWith(inframaq);
    expect(apps.install).toHaveBeenCalledWith(pulso);
    expect(screen.getByText('Instalar en INFRAMAQ')).toBeInTheDocument();
  });

  it('a narrow window opens on the list and a chosen app replaces it; a wide one already shows the first detail', () => {
    // Arrange
    render(<AppDirectory space={space} apps={appsOf()} />);
    const list = screen.getByTestId('directorio-lista');
    // Act
    const before = { list: list.className, detail: screen.getByTestId('directorio-detalle').className, firstShown: screen.queryByTestId('detalle-app-a1') !== null };
    fireEvent.click(screen.getByTestId('fila-app-a2'));
    // Assert
    expect(before.list).toMatch(/(^| )flex( |$)/);
    expect(before.detail).toMatch(/(^| )hidden( |$)/);
    expect(before.firstShown).toBe(true);
    expect(list.className).toMatch(/(^| )hidden( |$)/);
    expect(screen.getByTestId('directorio-detalle').className).toMatch(/(^| )block( |$)/);
  });

  it('while the server uninstalls, the detail says «Desinstalando…» and «Mensaje» waits', () => {
    render(<AppDirectory space={space} apps={appsOf({ uninstallingId: 'a1' })} />);
    expect(screen.getByTestId('app-desinstalando')).toHaveTextContent('Desinstalando…');
    expect(screen.queryByText('Instalada', { selector: '[data-testid="detalle-app-a1"] span' })).toBeNull();
    expect(screen.getByTestId('app-mensaje')).toBeDisabled();
  });

  it('one detail with tabs (pending 99): Información · Comandos · Avisos · Ajustes once installed, the first two before', () => {
    // Arrange
    render(<AppDirectory space={space} apps={appsOf()} />);
    const tabsNow = () => screen.getAllByRole('tab').map((tab) => tab.textContent);
    // Act
    const installed = tabsNow();
    const commandsBefore = screen.queryByText('/clima [mañana]');
    fireEvent.click(screen.getByTestId('app-ver-comandos'));
    const commandsAfter = screen.queryByText('/clima [mañana]') !== null;
    fireEvent.click(screen.getByTestId('fila-app-a2'));
    // Assert
    expect(installed).toEqual(['Información', 'Comandos', 'Avisos', 'Ajustes']);
    expect(commandsBefore).toBeNull();
    expect(commandsAfter).toBe(true);
    expect(tabsNow()).toEqual(['Información', 'Comandos']);
    // Another app opens on its Información, not on the tab the previous one was in.
    expect(screen.queryByText('Pulso no tiene comandos.')).toBeNull();
  });

  it('Ajustes: an admin reinstalls or uninstalls after confirming; a member does not see it', () => {
    // Arrange
    const apps = appsOf({ directory: { apps: [{ ...inframaq, installUrl: 'https://agentes.example.com/install?app=inframaq' }, pulso], canInstall: true } });
    const view = render(<AppDirectory space={space} apps={apps} />);
    // Act
    fireEvent.click(screen.getByTestId('pestana-detalle-settings'));
    fireEvent.click(screen.getByTestId('app-reinstalar'));
    fireEvent.click(screen.getByTestId('app-desinstalar'));
    fireEvent.click(screen.getByTestId('app-confirmar-desinstalar'));
    view.unmount();
    render(<AppDirectory space={space} apps={appsOf({ directory: { apps: [inframaq], canInstall: false } })} />);
    fireEvent.click(screen.getByTestId('pestana-detalle-settings'));
    // Assert
    expect(apps.install).toHaveBeenCalledTimes(1);
    expect(apps.uninstall).toHaveBeenCalledWith(expect.objectContaining({ appId: 'a1' }));
    expect(screen.queryByTestId('app-desinstalar')).toBeNull();
  });

  it('the search narrows the list and says when nothing matches', () => {
    render(<AppDirectory space={space} apps={appsOf()} />);
    fireEvent.change(screen.getByTestId('buscar-apps'), { target: { value: 'zzz' } });
    expect(screen.getByText('No hay apps con ese nombre o categoría.')).toBeInTheDocument();
  });

  it('a member sees no «Instalar», and the note that an admin installs', () => {
    render(<AppDirectory space={space} apps={appsOf({ directory: { apps: [inframaq, { ...pulso, installUrl: undefined }], canInstall: false } })} />);
    expect(screen.getByText('Las apps las instala un admin del espacio.')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fila-app-a2'));
    expect(screen.queryByTestId('app-instalar')).toBeNull();
  });
});

describe('AppsSection (design e-23)', () => {
  it('the 1:1s with apps and the installed apps not talked to yet; the grid opens the directory', () => {
    // Arrange
    const apps = appsOf({ directory: { apps: [inframaq, { ...pulso, installation: { ...installation, installationId: 'i2', botUserId: 'bot2' } }], canInstall: true } });
    const onOpenChat = vi.fn();
    const chat = { id: 'c1', kind: 'direct', name: 'Inframaq', appId: 'a1', unread: 2, memberIds: [], lastSeq: 2, othersReadSeq: 0, othersDeliveredSeq: 0, lastMessage: null } as unknown as ChatSummary;
    render(<AppsSection chats={[chat]} apps={apps} folded={false} onToggle={() => undefined} selectedChatId={null} onOpenChat={onOpenChat} />);
    // Act
    fireEvent.click(screen.getByTestId('app-fila-a1'));
    fireEvent.click(screen.getByTestId('app-fila-a2'));
    fireEvent.click(screen.getByTestId('explorar-apps'));
    // Assert
    expect(onOpenChat).toHaveBeenCalledWith(chat);
    expect(apps.message).toHaveBeenCalledWith(expect.objectContaining({ appId: 'a2' }));
    expect(apps.openDirectory).toHaveBeenCalled();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('the 1:1 just opened with an app is marked while it has no message yet (it is not in the list)', () => {
    const apps = appsOf({ directory: { apps: [inframaq], canInstall: true }, openedChats: { a1: 'c9' } });
    render(<AppsSection chats={[]} apps={apps} folded={false} onToggle={() => undefined} selectedChatId="c9" onOpenChat={() => undefined} />);
    expect(screen.getByTestId('app-fila-a1')).toHaveAttribute('aria-current', 'true');
  });
});

describe('AppLogo', () => {
  it('a logo that does not load becomes the robot, not a broken image', () => {
    const { container } = render(<AppLogo avatarUrl="https://agentes.example.com/apps/x/avatar.svg" size={24} />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('the 1:1 with an app (design e-26)', () => {
  it('its head has «APP», who made it and the two tabs; no calls', () => {
    const onTab = vi.fn();
    render(<AppConversationHeader app={inframaq} tab="messages" onTab={onTab} showBack={false} onBack={() => undefined} />);
    fireEvent.click(screen.getByTestId('pestana-app-info'));
    expect(screen.getByText('de Agentes ConstRoad')).toBeInTheDocument();
    expect(onTab).toHaveBeenCalledWith('info');
    expect(screen.queryByTestId('btn-llamada')).toBeNull();
  });

  it('its commands over the bar', () => {
    render(<AppCommandsBar commands={inframaq.commands} />);
    expect(screen.getByText('/clima')).toBeInTheDocument();
  });
});
