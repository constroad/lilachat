import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceDetailWeb } from './ServiceDetailWeb';

/** José 30/10: «no veo cómo navegar en el servicio, qué informes, qué pedidos, qué despachos» (design f-04). */
afterEach(() => vi.unstubAllGlobals());
const service = { id: 'srv-318', name: 'Pavimentación Av. Los Álamos', status: 'in_progress' as const, stage_label: 'Ejecución', progress: 62 };
const target = { jwt: 'jwt', spaceId: 's1', clientId: 'cli-cvs' };
const reply = (body: object) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const detail = {
  service: { id: 'srv-318', name: 'Pavimentación Av. Los Álamos', url: 'https://portal.constroad.com/s/318' },
  orders: [{ id: 'o1', product: 'Asfalto MAC 2', quantity: 120, unit: 'm³', date: '2026-10-22', status: { label: 'Entregado', tone: 'ok' } }],
  dispatches: [{ id: 'd1', plate: 'ABC-123', quantity: 12, unit: 'm³', status: { label: 'En ruta', tone: 'info' }, guideUrl: 'https://lila.constroad.com/g/1' }],
  reports: [],
  totals: { orders: 148, dispatches: 1, reports: 0 },
};

describe('ServiceDetailWeb', () => {
  it('asks for the detail and shows the head, Portal’s counts and the orders', async () => {
    // Arrange
    const fetchMock = reply({ detail });
    vi.stubGlobal('fetch', fetchMock);
    // Act
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    // Assert
    expect(await screen.findByTestId('fila-o1')).toHaveTextContent('Asfalto MAC 2');
    expect(screen.getByTestId('fila-o1')).toHaveTextContent('120 m³ · 22 oct');
    expect(screen.getByTestId('fila-o1')).toHaveTextContent('Entregado');
    expect(screen.getByTestId('detalle-servicio')).toHaveTextContent('Etapa: Ejecución');
    expect(screen.getByTestId('pestana-detalle-orders')).toHaveTextContent('Pedidos · 148');
    expect(screen.getByText('Mostrando 1 de 148 · el resto está en el Portal')).toBeInTheDocument();
    expect(screen.getByTestId('abrir-servicio-portal')).toHaveAttribute('href', 'https://portal.constroad.com/s/318');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/api/workspaces/s1/clients/cli-cvs/services/srv-318/detail');
  });

  it('another tab shows its rows with their file, and an empty one says so', async () => {
    vi.stubGlobal('fetch', reply({ detail }));
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-dispatches'));
    expect(screen.getByTestId('archivo-d1')).toHaveAttribute('href', 'https://lila.constroad.com/g/1');
    fireEvent.click(screen.getByTestId('pestana-detalle-reports'));
    expect(screen.getByText('Todavía no hay informes.')).toBeInTheDocument();
  });

  it('a row opens its sheet inside Lilachat: an order with its dispatches, Portal only at the foot', async () => {
    vi.stubGlobal('fetch', reply({ detail: { ...detail, dispatches: [{ ...detail.dispatches[0], orderId: 'o1' }] } }));
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    fireEvent.click(await screen.findByText('Asfalto MAC 2'));
    expect(screen.getByTestId('ficha-registro')).toHaveTextContent('Cantidad120 m³');
    expect(screen.getByTestId('relacionado-d1')).toHaveTextContent('ABC-123');
    expect(screen.queryByTestId('ficha-en-portal')).toBeNull();
  });

  it('«Cobranza» shows the credit, what is pending and the line items when billing came', async () => {
    const billing = { isCredit: true, dueAt: '2099-01-10', total: 1000, collected: 250, pending: 750, items: [{ name: 'Transporte a obra', total: 600, invoiced: true }], payments: [] };
    vi.stubGlobal('fetch', reply({ detail: { ...detail, billing } }));
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-billing'));
    expect(screen.getByTestId('condicion-de-pago')).toHaveTextContent('Vence el 10 ene 2099');
    expect(screen.getByTestId('estado-de-cobranza')).toHaveTextContent('25 % cobrado');
    expect(screen.getByTestId('estado-de-cobranza')).toHaveTextContent('S/ 750.00');
    expect(screen.getByTestId('partidas')).toHaveTextContent('Facturada');
    expect(screen.getByTestId('pagos')).toHaveTextContent('Todavía no hay pagos registrados.');
  });

  it('when the app fails it says so with Portal’s link; «Servicios» goes back', async () => {
    const onBack = vi.fn();
    vi.stubGlobal('fetch', reply({ error: 'detail_failed', message: 'No se pudo traer el detalle del servicio', portal_url: 'https://portal.constroad.com/s/318' }));
    render(<ServiceDetailWeb target={target} service={service} onBack={onBack} />);
    expect(await screen.findByTestId('detalle-fallo')).toHaveTextContent('No se pudo traer el detalle del servicio');
    expect(screen.getByTestId('detalle-fallo-portal')).toHaveAttribute('href', 'https://portal.constroad.com/s/318');
    fireEvent.click(screen.getByTestId('volver-a-servicios'));
    expect(onBack).toHaveBeenCalled();
  });
  it('a report with no PDF stored asks Portal; while it generates it says so, and ready its link opens (agentes 30/10)', async () => {
    // Arrange
    const withReport = { ...detail, reports: [{ id: 'r9', title: 'Control de compactación', status: { label: 'Publicado', tone: 'ok' } }], totals: { ...detail.totals, reports: 1 } };
    const bodies = [{ detail: withReport }, { pdf: { status: 'generating', retryAfterS: 1 } }, { pdf: { status: 'ready', pdfUrl: 'https://lila.constroad.com/r9.pdf' } }];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(bodies.shift()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-reports'));
    fireEvent.click(within(screen.getByTestId('fila-r9')).getByRole('button'));
    // Act
    fireEvent.click(screen.getByTestId('pedir-pdf-ficha'));
    // Assert
    expect(await screen.findByText('Generando el PDF…')).toBeInTheDocument();
    expect(await screen.findByTestId('abrir-pdf-ficha', {}, { timeout: 3000 })).toHaveAttribute('href', 'https://lila.constroad.com/r9.pdf');
    expect(String((fetchMock.mock.calls[1] as unknown as [string])[0])).toContain('/api/workspaces/s1/clients/cli-cvs/services/srv-318/reports/r9/pdf');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
