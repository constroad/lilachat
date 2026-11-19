import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SERVICE_CROQUIS_NOT_ENABLED, type MapEditSend } from '@lilachat/shared';
import { ServiceCroquisButton } from './ServiceCroquis';

afterEach(cleanup);

const url = 'https://www.constroad.com/embed/service-croquis/6aedcc3a2f5e395dca260f16#t=abc.DEF_123-x';

/** José 19/11: «Editar croquis» opens Portal's croquis editor of the service. */
describe('ServiceCroquisButton', () => {
  it('opens Portal\'s croquis editor of the service in the frame', async () => {
    // Arrange
    const send: MapEditSend = vi.fn(async () => ({ ok: true as const, message: '', data: { url, expiresAt: '2026-11-20T08:00:00.000Z' } }));
    render(<ServiceCroquisButton send={send} title="Pavimentación Los Olivos" onDone={vi.fn()} className="" />);
    // Act
    fireEvent.click(screen.getByTestId('mapa-editar-croquis'));
    // Assert
    expect(await screen.findByTestId('editor-portal-marco')).toHaveAttribute('src', url);
    expect(send).toHaveBeenCalledWith({ kind: 'service_croquis', forms: 3 }, expect.any(Function));
  });

  it('while agentes does not offer the tool, it says so instead of breaking', async () => {
    // Arrange
    const send: MapEditSend = vi.fn(async () => ({ ok: false as const, message: SERVICE_CROQUIS_NOT_ENABLED }));
    render(<ServiceCroquisButton send={send} title="Obra" onDone={vi.fn()} className="" />);
    // Act
    fireEvent.click(screen.getByTestId('mapa-editar-croquis'));
    // Assert
    expect(await screen.findByText(SERVICE_CROQUIS_NOT_ENABLED)).toBeInTheDocument();
    expect(screen.queryByTestId('editor-portal-marco')).not.toBeInTheDocument();
  });

  it('closing the editor reads the map again, so new drawings show', async () => {
    // Arrange
    const onDone = vi.fn();
    const send: MapEditSend = vi.fn(async () => ({ ok: false as const, message: SERVICE_CROQUIS_NOT_ENABLED }));
    render(<ServiceCroquisButton send={send} title="Obra" onDone={onDone} className="" />);
    fireEvent.click(screen.getByTestId('mapa-editar-croquis'));
    // Act
    fireEvent.click(await screen.findByTestId('editor-portal-volver'));
    // Assert
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('editor-portal')).not.toBeInTheDocument();
  });
});
