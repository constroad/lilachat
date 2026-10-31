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
    // José 30/10: progress comes from Portal, stage by stage; 30/10 night: folded in the progress card.
    expect(screen.getByTestId('etapas-servicio')).toHaveTextContent(/Etapas · \d+ de \d+/);
    expect(screen.queryByTestId('etapa-orders-done')).toBeNull();
    fireEvent.click(screen.getByTestId('etapas-toggle'));
    expect(screen.getByTestId('etapa-orders-done')).toHaveTextContent('Pedidos');
    expect(screen.getByText('Mostrando 1 de 148 · el resto está en el Portal')).toBeInTheDocument();
    expect(screen.getByTestId('abrir-servicio-portal')).toHaveAttribute('href', 'https://portal.constroad.com/s/318');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/api/workspaces/s1/clients/cli-cvs/services/srv-318/detail');
  });

  it('another tab shows its rows with their file in the viewer, and an empty one says so', async () => {
    vi.stubGlobal('fetch', reply({ detail }));
    const opened = vi.fn();
    vi.stubGlobal('open', opened);
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-dispatches'));
    fireEvent.click(screen.getByTestId('archivo-d1'));
    // José 30/10 night: «solo abre la url en la web» — a photo or a PDF opens in the viewer; a file of unknown kind, in a tab.
    expect(opened).toHaveBeenCalledWith('https://lila.constroad.com/g/1', '_blank', 'noopener');
    fireEvent.click(screen.getByTestId('pestana-detalle-reports'));
    expect(screen.getByText('Todavía no hay informes.')).toBeInTheDocument();
  });

  it('José 30/10 night: Cotizaciones and Cobranza first; a dispatch shows its photos and cubicaje; invoices in Cobranza, guides in Despachos', async () => {
    // Arrange
    const billing = { isCredit: false, total: 1000, collected: 0, pending: 1000, items: [], payments: [] };
    const orders = [{ ...detail.orders[0], invoice: 'F001-9', invoiceUrl: 'https://lila.constroad.com/f9.pdf', guides: [{ name: 'Guía 001-2', url: 'https://lila.constroad.com/g2.jpg' }] }];
    const dispatches = [{ ...detail.dispatches[0], pictures: [{ url: 'https://lila.constroad.com/p1.jpg', mime: 'image/jpeg' }], cubicage: { m3: 25.5, shape: 'Cuadrado', dimensions: [] } }];
    vi.stubGlobal('fetch', reply({ detail: { ...detail, orders, dispatches, quotes: [{ id: 'q1', code: '300', status: { label: 'Borrador', tone: 'neutral' } }], billing, totals: { ...detail.totals, quotes: 1 } } }));
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    // Act
    const tabs = (await screen.findAllByRole('tab')).map((tab) => tab.getAttribute('data-testid'));
    const firstShown = screen.getByTestId('pestana-detalle-quotes').getAttribute('aria-selected');
    fireEvent.click(screen.getByTestId('pestana-detalle-billing'));
    const invoices = screen.getByTestId('facturas').textContent;
    fireEvent.click(screen.getByTestId('pestana-detalle-dispatches'));
    const guides = screen.getByTestId('guias-del-pedido').textContent;
    fireEvent.click(within(screen.getByTestId('fila-d1')).getAllByRole('button')[0]!);
    // José 31/10: the cubicaje is folded behind a button with its m³ and shape.
    const folded = screen.getByTestId('ver-grupo-Cubicaje').textContent;
    fireEvent.click(screen.getByTestId('ver-grupo-Cubicaje'));
    const cubicage = screen.getByTestId('grupo-Cubicaje').textContent;
    fireEvent.click(screen.getByTestId('media-ficha-0'));
    // Assert
    expect(tabs).toEqual(['pestana-detalle-quotes', 'pestana-detalle-billing', 'pestana-detalle-orders', 'pestana-detalle-dispatches', 'pestana-detalle-reports']);
    expect(firstShown).toBe('true');
    expect(invoices).toContain('Factura F001-9');
    expect(guides).toContain('Guía 001-2 · Asfalto MAC 2');
    expect(folded).toBe('Ver cubicaje25.5 m³ · Cuadrado');
    expect(cubicage).toContain('Volquete cubica25.5 m³');
    expect(screen.getByTestId('visor-fotos')).toBeInTheDocument();
  });

  it('the reports come under a header per day, newest first (José 31/10: «como lo hace la web»)', async () => {
    // Arrange
    const status = { label: 'Borrador', tone: 'neutral' };
    const reports = [{ id: 'r5', title: 'Control de pista · 5 de octubre', date: '2026-10-05', status }, { id: 'r6', title: 'Producción de planta · 6 de octubre', date: '2026-10-06', status }];
    vi.stubGlobal('fetch', reply({ detail: { ...detail, reports, totals: { ...detail.totals, reports: 2 } } }));
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} />);
    // Act
    fireEvent.click(await screen.findByTestId('pestana-detalle-reports'));
    // Assert
    const days = screen.getAllByTestId(/^dia-informes-/).map((day) => day.getAttribute('data-testid'));
    expect(days).toEqual(['dia-informes-6 de octubre', 'dia-informes-5 de octubre']);
    expect(within(screen.getByTestId('fila-r6')).getByText('Producción de planta')).toBeInTheDocument();
  });

  it('an order\'s sheet makes its link with what Portal\'s modal asks (José 31/10: «un CTA para crear el enlace de pedido»)', async () => {
    // Arrange
    vi.stubGlobal('fetch', reply({ detail }));
    const open = vi.fn();
    render(<ServiceDetailWeb target={target} service={service} onBack={() => undefined} links={{ can: (kind) => kind === 'order', open }} />);
    // Act
    fireEvent.click(within(await screen.findByTestId('fila-o1')).getByText('Asfalto MAC 2'));
    fireEvent.click(screen.getByTestId('accion-ficha'));
    // Assert
    expect(screen.getByTestId('accion-ficha')).toHaveTextContent('Crear enlace del pedido');
    expect(open).toHaveBeenCalledWith({ kind: 'order', clientId: 'cli-cvs', orderId: 'o1' });
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
