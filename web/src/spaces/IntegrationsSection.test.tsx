import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IntegrationsSection } from './IntegrationsSection';

vi.mock('./spacesApi', () => ({
  spaceApps: vi.fn(async () => ({ ok: true, data: { apps: [{ id: 'inst1', appId: 'app1', name: 'Portal', installedBy: 'José', installedAt: '2026-10-20T10:00:00.000Z' }] } })),
  uninstallApp: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock('./AvailableApps', () => ({ AvailableApps: () => null }));

/** Integraciones in the space's settings: each installed app opens its own detail (debt of §151). */
describe('Integraciones', () => {
  it('tapping an installed app opens its detail by the app, not by the installation', async () => {
    // Arrange
    const onOpenApp = vi.fn();
    render(<IntegrationsSection jwt="t" spaceId="s1" onOpenApp={onOpenApp} />);
    // Act
    fireEvent.click(await screen.findByTestId('abrir-app-inst1'));
    // Assert
    expect(onOpenApp).toHaveBeenCalledWith('app1');
  });

  it('«Desinstalar» stays its own button and does not open the detail', async () => {
    // Arrange
    const onOpenApp = vi.fn();
    render(<IntegrationsSection jwt="t" spaceId="s1" onOpenApp={onOpenApp} />);
    // Act
    fireEvent.click(await screen.findByTestId('desinstalar-inst1'));
    // Assert
    expect(onOpenApp).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirmar-desinstalar-inst1')).toBeInTheDocument();
  });

  it('without a way to open it, the row is plain text', async () => {
    // Arrange
    render(<IntegrationsSection jwt="t" spaceId="s1" />);
    // Act
    await screen.findByText('Portal');
    // Assert
    expect(screen.queryByTestId('abrir-app-inst1')).not.toBeInTheDocument();
  });
});
