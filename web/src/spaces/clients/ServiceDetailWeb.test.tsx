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

describe('an open service takes the whole conversation (José 06/11: «ocupe todo con sus tabs de pedido informes drive»)', () => {
  const driveReply = { files: [{ name: 'densidades.pdf', mime: 'application/pdf', url: 'https://x/d', folder: 'Informes' }], drive_url: null };
  const askedFor = (url: string) => new Response(JSON.stringify(url.endsWith('/files') ? driveReply : { detail }), { status: 200 });

  it('the breadcrumb goes back to the chat or to the services', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async (url: string) => askedFor(url)));
    const onToChat = vi.fn();
    const onBack = vi.fn();
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={onBack} onToChat={onToChat} />);
    // Act
    fireEvent.click(await screen.findByTestId('volver-al-chat'));
    fireEvent.click(screen.getByTestId('volver-a-servicios'));
    // Assert
    expect(onToChat).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ruta-servicio')).toHaveTextContent('Pavimentación Av. Los Álamos');
  });

  it('the Drive is one more tab: its folders open and come back without leaving the service', async () => {
    // Arrange
    const fetchMock = vi.fn(async (url: string) => askedFor(url));
    vi.stubGlobal('fetch', fetchMock);
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney seesDrive onBack={() => undefined} />);
    // Act
    fireEvent.click(await screen.findByTestId('pestana-detalle-drive'));
    fireEvent.click(await screen.findByTestId('carpeta-Informes'));
    fireEvent.click(await screen.findByTestId('volver-a-drive'));
    // Assert
    expect(await screen.findByTestId('carpeta-Informes')).toHaveTextContent('1');
    expect(fetchMock.mock.calls.map((call) => String(call[0])).some((url) => url.includes('/services/srv-318/files'))).toBe(true);
    expect(screen.queryByTestId('fila-o1')).toBeNull();
  });

  it('without the Drive there is no such tab', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async (url: string) => askedFor(url)));
    // Act
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney={false} onBack={() => undefined} />);
    // Assert
    expect(await screen.findByTestId('pestana-detalle-reports')).toBeInTheDocument();
    expect(screen.queryByTestId('pestana-detalle-drive')).toBeNull();
  });

  it('a member an admin gave only the Drive sees it alone: the orders are not even asked', async () => {
    // Arrange
    const fetchMock = vi.fn(async (url: string) => askedFor(url));
    vi.stubGlobal('fetch', fetchMock);
    // Act
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney={false} seesDrive driveOnly onBack={() => undefined} />);
    // Assert
    expect(await screen.findByTestId('carpeta-Informes')).toBeInTheDocument();
    expect(screen.queryByTestId('pestana-detalle-orders')).toBeNull();
    expect(fetchMock.mock.calls.map((call) => String(call[0])).every((url) => url.endsWith('/files'))).toBe(true);
  });
});

describe('ServiceDetailWeb', () => {
  it('José 05/11: «Crear informe» for everyone with the services; the picker offers the eight types, the ones not here open Portal, and CTL-IMP opens the report', async () => {
    // Arrange
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/reports/draft') ? { error: 'report_draft_failed', message: 'No se pudo abrir el informe' } : { detail }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ServiceDetailWeb people={['Rosa Vega']} target={target} chatId="chat-1" service={service} seesMoney={false} onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-reports'));
    expect(screen.queryByTestId('generar-informe-servicio')).toBeNull();
    // Act
    fireEvent.click(screen.getByTestId('crear-informe'));
    // Assert
    const types = within(screen.getByTestId('crear-informe-tipos')).getAllByTestId(/^tipo-informe-/);
    expect(types).toHaveLength(8);
    expect(screen.getByTestId('tipo-informe-IAA')).toHaveAttribute('href', 'https://portal.constroad.com/s/318');
    expect(screen.getByTestId('tipo-informe-IAA')).toHaveTextContent('En Portal');
    fireEvent.click(screen.getByTestId('tipo-informe-CTL-IMP'));
    expect(screen.getByTestId('responsable-de-informe')).toHaveTextContent('¿Quién es el responsable?');
    fireEvent.change(screen.getByTestId('responsable-nombre'), { target: { value: '' } });
    expect(screen.getByTestId('responsable-confirmar')).toBeDisabled();
    fireEvent.click(screen.getByTestId('responsable-opcion-Rosa Vega'));
    fireEvent.click(screen.getByTestId('responsable-confirmar'));
    expect(await screen.findByTestId('informe-fallo')).toHaveTextContent('No se pudo abrir el informe');
    expect(String((fetchMock.mock.calls.at(-1) as unknown as [string])[0])).toContain('/services/srv-318/reports/draft');
    fireEvent.click(screen.getByTestId('volver-al-servicio'));
    expect(await screen.findByTestId('crear-informe')).toBeInTheDocument();
  });

  it('asks for the detail and shows the head, Portal’s counts and the orders', async () => {
    // Arrange
    const fetchMock = reply({ detail });
    vi.stubGlobal('fetch', fetchMock);
    // Act
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney admin onBack={() => undefined} />);
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

  it('a member who is not an admin sees no stages, not even with money marked (José 07/11: «quitar el detalle para los que no son admins»)', async () => {
    // Arrange
    vi.stubGlobal('fetch', reply({ detail }));
    // Act
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
    // Assert
    expect(await screen.findByTestId('fila-o1')).toBeInTheDocument();
    expect(screen.queryByTestId('etapas-servicio')).not.toBeInTheDocument();
    expect(screen.getByTestId('detalle-servicio')).toHaveTextContent('Etapa: Ejecución');
  });

  it('no «Despachos» tab: an order opens its dispatches, each with its file in the viewer, and closing goes back to the order (José 01/11)', async () => {
    vi.stubGlobal('fetch', reply({ detail: { ...detail, dispatches: [{ ...detail.dispatches[0], orderId: 'o1' }] } }));
    const opened = vi.fn();
    vi.stubGlobal('open', opened);
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
    expect(await screen.findByTestId('fila-o1')).toHaveTextContent('1 despacho');
    expect(screen.queryByTestId('pestana-detalle-dispatches')).toBeNull();
    fireEvent.click(screen.getByText('Asfalto MAC 2'));
    fireEvent.click(screen.getByTestId('relacionado-d1'));
    expect(screen.getByTestId('ficha-registro')).toHaveTextContent('Pedido');
    fireEvent.click(screen.getByTestId('ver-archivo-ficha'));
    // José 30/10 night: «solo abre la url en la web» — a photo or a PDF opens in the viewer; a file of unknown kind, in a tab.
    expect(opened).toHaveBeenCalledWith('https://lila.constroad.com/g/1', '_blank', 'noopener');
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.getByTestId('relacionado-d1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByTestId('ficha-registro')).toBeNull();
    fireEvent.click(screen.getByTestId('pestana-detalle-reports'));
    expect(screen.getByText('Todavía no hay informes.')).toBeInTheDocument();
  });

  it('José 05/11: no money tab, even when the answer brings it; a dispatch shows its photos and cubicaje, guides in their order', async () => {
    // Arrange
    const billing = { isCredit: false, total: 1000, collected: 0, pending: 1000, items: [], payments: [] };
    const orders = [{ ...detail.orders[0], invoice: 'F001-9', invoiceUrl: 'https://lila.constroad.com/f9.pdf', guides: [{ name: 'Guía 001-2', url: 'https://lila.constroad.com/g2.jpg' }] }];
    const dispatches = [{ ...detail.dispatches[0], orderId: 'o1', pictures: [{ url: 'https://lila.constroad.com/p1.jpg', mime: 'image/jpeg' }], cubicage: { m3: 25.5, shape: 'Cuadrado', dimensions: [] } }];
    vi.stubGlobal('fetch', reply({ detail: { ...detail, orders, dispatches, quotes: [{ id: 'q1', code: '300', status: { label: 'Borrador', tone: 'neutral' } }], billing, totals: { ...detail.totals, quotes: 1 } } }));
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
    // Act
    const tabs = (await screen.findAllByRole('tab')).map((tab) => tab.getAttribute('data-testid'));
    fireEvent.click(screen.getByText('Asfalto MAC 2'));
    const guides = screen.getByTestId('ficha-registro').textContent;
    fireEvent.click(screen.getByTestId('relacionado-d1'));
    // José 31/10: the cubicaje is folded behind a button with its m³ and shape.
    const folded = screen.getByTestId('ver-grupo-Cubicaje').textContent;
    fireEvent.click(screen.getByTestId('ver-grupo-Cubicaje'));
    const cubicage = screen.getByTestId('grupo-Cubicaje').textContent;
    fireEvent.click(screen.getByTestId('media-ficha-0'));
    // Assert
    expect(tabs).toEqual(['pestana-detalle-orders', 'pestana-detalle-reports']);
    expect(screen.queryByTestId('cobranza')).toBeNull();
    expect(guides).toContain('Ver Guía 001-2');
    expect(folded).toBe('Ver cubicaje25.5 m³ · Cuadrado');
    expect(cubicage).toContain('Volquete cubica25.5 m³');
    expect(screen.getByTestId('visor-fotos')).toBeInTheDocument();
  });

  it('the reports come under a header per day, newest first (José 31/10: «como lo hace la web»)', async () => {
    // Arrange
    const status = { label: 'Borrador', tone: 'neutral' };
    const reports = [{ id: 'r5', title: 'Control de pista · 5 de octubre', date: '2026-10-05', status }, { id: 'r6', title: 'Producción de planta · 6 de octubre', date: '2026-10-06', status }];
    vi.stubGlobal('fetch', reply({ detail: { ...detail, reports, totals: { ...detail.totals, reports: 2 } } }));
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
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
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} links={{ can: (kind) => kind === 'order', open, map: vi.fn() }} />);
    // Act
    fireEvent.click(within(await screen.findByTestId('fila-o1')).getByText('Asfalto MAC 2'));
    fireEvent.click(screen.getByTestId('accion-ficha'));
    // Assert
    expect(screen.getByTestId('accion-ficha')).toHaveTextContent('Crear enlace del pedido');
    expect(open).toHaveBeenCalledWith({ kind: 'order', clientId: 'cli-cvs', orderId: 'o1' });
  });

  it('a service with a map shows «Mapa» only to whoever can make its link, and the tab asks for it (José 06/11)', async () => {
    // Arrange
    vi.stubGlobal('fetch', reply({ detail: { ...detail, service: { ...detail.service, hasMap: true } } }));
    const map = vi.fn(async () => ({ ok: true as const, url: 'https://constroad.com/public/mapa' }));
    const view = render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} links={{ can: () => false, open: vi.fn(), map }} />);
    await screen.findByTestId('pestana-detalle-orders');
    expect(screen.queryByTestId('pestana-detalle-map')).not.toBeInTheDocument();
    view.unmount();
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} links={{ can: (kind) => kind === 'service', open: vi.fn(), map }} />);
    // Act
    fireEvent.click(await screen.findByTestId('pestana-detalle-map'));
    // Assert
    expect(await screen.findByTestId('mapa-abrir')).toHaveAttribute('href', 'https://constroad.com/public/mapa/service/srv-318?section=map');
    expect(map).toHaveBeenCalledWith({ kind: 'service', clientId: 'cli-cvs', serviceId: 'srv-318' });
  });

  it('the map takes the whole conversation with the tabs in its bar, and «Pedidos» brings the list back (design o-01, José 07/11)', async () => {
    // Arrange
    vi.stubGlobal('fetch', reply({ detail: { ...detail, service: { ...detail.service, hasMap: true } } }));
    const map = vi.fn(async () => ({ ok: true as const, url: 'https://constroad.com/public/mapa' }));
    const onMapOpen = vi.fn();
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} onMapOpen={onMapOpen} links={{ can: (kind) => kind === 'service', open: vi.fn(), map }} />);

    // Act
    fireEvent.click(await screen.findByTestId('pestana-detalle-map'));

    // Assert
    await screen.findByTestId('mapa-abrir');
    expect(onMapOpen).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId('ruta-servicio')).toBeInTheDocument();
    expect(screen.getByTestId('pestana-detalle-map')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByTestId('pestana-detalle-orders'));
    expect(onMapOpen).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId('mapa-abrir')).not.toBeInTheDocument();
  });

  it('«Generar informe de servicio» runs informe_de_servicio from the space with the service: Portal refuses it in a group (01/11)', async () => {
    // Arrange
    const groups = [{ appId: 'p1', appName: 'Portal', commands: [], shortcuts: [{ key: 'informe_de_servicio', name: 'Informe de servicio' }] }];
    const answered = { commandId: 'c2', appId: 'p1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Tu informe está listo' } };
    const fetchMock = vi.fn(async (url: string) => {
      const body = String(url).includes('/commands?place=space') ? { groups } : String(url).endsWith('/shortcuts') ? answered : { detail };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-reports'));
    // Act
    fireEvent.click(await screen.findByTestId('generar-informe-servicio'));
    // Assert
    expect(await screen.findByText('Tu informe está listo')).toBeInTheDocument();
    const shortcut = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/shortcuts')) as unknown as [string, RequestInit];
    expect(shortcut[0]).toContain('/api/workspaces/s1/shortcuts');
    expect(JSON.parse(String(shortcut[1].body))).toMatchObject({ app_id: 'p1', shortcut: 'informe_de_servicio', values: { servicioId: 'srv-318' } });
  });

  it('no «Generar informe de servicio» while the server does not offer it to that person', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/commands?place=space') ? { groups: [] } : { detail }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-reports'));
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/commands?place=space'))).toBe(true));
    expect(screen.queryByTestId('generar-informe-servicio')).toBeNull();
  });

  it('José 05/11: «Generar informe de servicio» makes a liquidation with amounts: not for whoever does not see money', async () => {
    // Arrange
    const groups = [{ appId: 'p1', appName: 'Portal', commands: [], shortcuts: [{ key: 'informe_de_servicio', name: 'Informe' }] }];
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/commands?place=space') ? { groups } : { detail }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    // Act
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney={false} onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-reports'));
    // Assert
    expect(screen.queryByTestId('generar-informe-servicio')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/commands?place=space'))).toBe(false);
  });

  it('a row opens its sheet inside Lilachat: an order with its dispatches, Portal only at the foot', async () => {
    vi.stubGlobal('fetch', reply({ detail: { ...detail, dispatches: [{ ...detail.dispatches[0], orderId: 'o1' }] } }));
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
    fireEvent.click(await screen.findByText('Asfalto MAC 2'));
    expect(screen.getByTestId('ficha-registro')).toHaveTextContent('Cantidad120 m³');
    expect(screen.getByTestId('relacionado-d1')).toHaveTextContent('ABC-123');
    expect(screen.queryByTestId('ficha-en-portal')).toBeNull();
  });

  it('when the app fails it says so with Portal’s link; «Servicios» goes back', async () => {
    const onBack = vi.fn();
    vi.stubGlobal('fetch', reply({ error: 'detail_failed', message: 'No se pudo traer el detalle del servicio', portal_url: 'https://portal.constroad.com/s/318' }));
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={onBack} />);
    expect(await screen.findByTestId('detalle-fallo')).toHaveTextContent('No se pudo traer el detalle del servicio');
    expect(screen.getByTestId('detalle-fallo-portal')).toHaveAttribute('href', 'https://portal.constroad.com/s/318');
    fireEvent.click(screen.getByTestId('volver-a-servicios'));
    expect(onBack).toHaveBeenCalled();
  });
  it('a report with no PDF stored asks Portal; while it generates it says so, and ready its link opens (agentes 30/10)', async () => {
    // Arrange
    const withReport = { ...detail, reports: [{ id: 'r9', title: 'Control de compactación', status: { label: 'Publicado', tone: 'ok' } }], totals: { ...detail.totals, reports: 1 } };
    const bodies = [{ detail: withReport }, { pdf: { status: 'generating', retryAfterS: 1 } }, { pdf: { status: 'ready', pdfUrl: 'https://lila.constroad.com/r9.pdf' } }];
    // Informes also asks the space for its button; that answer is not one of these.
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/commands?place=space') ? { groups: [] } : bodies.shift()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ServiceDetailWeb target={target} chatId="chat-1" service={service} seesMoney onBack={() => undefined} />);
    fireEvent.click(await screen.findByTestId('pestana-detalle-reports'));
    fireEvent.click(within(screen.getByTestId('fila-r9')).getByRole('button'));
    // Act
    fireEvent.click(screen.getByTestId('pedir-pdf-ficha'));
    // Assert
    expect(await screen.findByText('Generando el PDF…')).toBeInTheDocument();
    expect(await screen.findByTestId('abrir-pdf-ficha', {}, { timeout: 3000 })).toHaveAttribute('href', 'https://lila.constroad.com/r9.pdf');
    const portalCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => !url.includes('/commands?place=space'));
    expect(portalCalls[1]).toContain('/api/workspaces/s1/clients/cli-cvs/services/srv-318/reports/r9/pdf');
    expect(portalCalls).toHaveLength(3);
  });
});
