import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SpaceClientService } from '@lilachat/shared';
import { ServiceCard } from './ServiceCardWeb';

/** José 19/11, design cc-01: the figures of each service, only with what Portal sends. */
const base: SpaceClientService = { id: 's1', name: 'Bacheo Av. Grau', status: 'in_progress', stage_label: 'En ejecución', progress: 64, started_at: '2026-10-28' };
const withFacts: SpaceClientService = { ...base, ordersCount: 5, reportsCount: 9, stagesTotal: 6, lastActivity: { at: '2026-10-30T15:00:00.000Z', text: 'Control de pista' } };

const asPhone = () => vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe('ServiceCard on a tablet or a computer', () => {
  it('draws the row with orders, reports and the last movement in their columns', () => {
    // Arrange / Act
    render(<ServiceCard service={withFacts} canOpen onOpen={vi.fn()} />);
    // Assert
    expect(screen.getByTestId('pedidos-servicio-s1')).toHaveTextContent('5');
    expect(screen.getByTestId('informes-servicio-s1')).toHaveTextContent('9');
    expect(screen.getByTestId('movimiento-servicio-s1')).toHaveTextContent('30 oct · Control de pista');
    expect(screen.getByTestId('inicio-servicio-s1')).toHaveTextContent('Inicio 28 oct · 6 etapas');
  });

  it('a service without data (0/0/0) shows its zeros, not «—»', () => {
    render(<ServiceCard service={{ ...base, ordersCount: 0, reportsCount: 0, stagesTotal: 0 }} canOpen onOpen={vi.fn()} />);
    expect(screen.getByTestId('pedidos-servicio-s1')).toHaveTextContent('0');
    expect(screen.getByTestId('informes-servicio-s1')).toHaveTextContent('0');
    expect(screen.getByTestId('inicio-servicio-s1')).toHaveTextContent('Inicio 28 oct');
  });

  it('shows «—» for a figure an older Portal did not send, never a number', () => {
    render(<ServiceCard service={base} canOpen onOpen={vi.fn()} />);
    expect(screen.getByTestId('pedidos-servicio-s1')).toHaveTextContent('—');
    expect(screen.getByTestId('informes-servicio-s1')).toHaveTextContent('—');
    expect(screen.getByTestId('movimiento-servicio-s1')).toHaveTextContent('—');
    expect(screen.getByTestId('inicio-servicio-s1')).toHaveTextContent('Inicio 28 oct');
  });
});

describe('ServiceCard on a phone', () => {
  it('reads «N pedidos · N informes» and the bar «Último movimiento: …»', () => {
    // Arrange
    asPhone();
    // Act
    render(<ServiceCard service={withFacts} canOpen onOpen={vi.fn()} />);
    // Assert
    expect(screen.getByTestId('pedidos-servicio-s1')).toHaveTextContent('5 pedidos');
    expect(screen.getByTestId('informes-servicio-s1')).toHaveTextContent('9 informes');
    expect(screen.getByTestId('movimiento-servicio-s1')).toHaveTextContent('Último movimiento: Control de pista');
  });

  it('hides the row and the bar when nothing came', () => {
    asPhone();
    render(<ServiceCard service={base} canOpen onOpen={vi.fn()} />);
    expect(screen.queryByTestId('pedidos-servicio-s1')).toBeNull();
    expect(screen.queryByTestId('movimiento-servicio-s1')).toBeNull();
    expect(screen.getByTestId('servicio-s1')).toHaveTextContent('64 %');
  });
});
