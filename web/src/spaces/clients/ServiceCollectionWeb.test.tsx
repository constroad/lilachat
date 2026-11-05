import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceCollectionWeb } from './ServiceCollectionWeb';

/** José 05/11: Cobranza moved from each service to «Cuenta», by service. */
afterEach(() => vi.unstubAllGlobals());
const target = { jwt: 'jwt', spaceId: 's1', clientId: 'cli-cvs' };
const service = { id: 'srv-318', name: 'Pavimentación Av. Los Álamos', isCredit: false };
const detail = { service: { id: 'srv-318', name: 'Pavimentación Av. Los Álamos' }, orders: [{ id: 'o1', status: { label: 'Entregado', tone: 'ok' }, invoice: 'F001-9', invoiceUrl: 'https://lila.constroad.com/f9.pdf' }], dispatches: [], reports: [], totals: { orders: 1, dispatches: 0, reports: 0 } };
const billing = { isCredit: true, dueAt: '2099-01-10', total: 1000, collected: 250, pending: 750, items: [{ name: 'Transporte a obra', total: 600, invoiced: true }], payments: [] };
const answerWith = (space: object, extra: (url: string) => object | null = () => null) => vi.fn(async (url: string) => new Response(JSON.stringify(extra(String(url)) ?? (String(url).includes('/commands?place=space') ? space : { detail: { ...detail, billing } })), { status: 200 }));
const show = (onPaid = vi.fn()) => render(<ServiceCollectionWeb target={target} service={service} onBack={() => undefined} onPaid={onPaid} />);

describe('ServiceCollectionWeb', () => {
  it('shows the credit, what is pending, the invoices and the line items', async () => {
    // Arrange
    vi.stubGlobal('fetch', answerWith({ groups: [] }));
    // Act
    show();
    // Assert
    expect(await screen.findByTestId('condicion-de-pago')).toHaveTextContent('Vence el 10 ene 2099');
    expect(screen.getByTestId('estado-de-cobranza')).toHaveTextContent('25 % cobrado');
    expect(screen.getByTestId('estado-de-cobranza')).toHaveTextContent('S/ 750.00');
    expect(screen.getByTestId('facturas')).toHaveTextContent('Factura F001-9');
    expect(screen.getByTestId('partidas')).toHaveTextContent('Facturada');
    expect(screen.getByTestId('pagos')).toHaveTextContent('Todavía no hay pagos registrados.');
  });

  it('«Registrar pago» runs registrar_pago from the space with the service, then asks it and the account again', async () => {
    // Arrange
    const groups = [{ appId: 'p1', appName: 'Portal', commands: [], shortcuts: [{ key: 'registrar_pago', name: 'Registrar pago' }] }];
    const answered = { commandId: 'c1', appId: 'p1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Pago registrado: S/ 250.00' } };
    const fetchMock = answerWith({ groups }, (url) => (url.endsWith('/shortcuts') ? answered : null));
    vi.stubGlobal('fetch', fetchMock);
    const onPaid = vi.fn();
    show(onPaid);
    // Act
    fireEvent.click(await screen.findByTestId('registrar-pago'));
    // Assert
    expect(await screen.findByText('Pago registrado: S/ 250.00')).toBeInTheDocument();
    const shortcut = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/shortcuts')) as unknown as [string, RequestInit];
    expect(JSON.parse(String(shortcut[1].body))).toMatchObject({ app_id: 'p1', shortcut: 'registrar_pago', values: { servicioId: 'srv-318' } });
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/billing'))).toHaveLength(2));
    expect(onPaid).toHaveBeenCalled();
  });

  it('no «Registrar pago» when the action is off or that person may not run it', async () => {
    // Arrange
    const fetchMock = answerWith({ groups: [] });
    vi.stubGlobal('fetch', fetchMock);
    // Act
    show();
    // Assert
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/commands?place=space'))).toBe(true));
    expect(screen.queryByTestId('registrar-pago')).toBeNull();
  });

  it('a service with nothing to collect says so', async () => {
    // Arrange
    vi.stubGlobal('fetch', answerWith({ groups: [] }, (url) => (url.endsWith('/billing') ? { detail } : null)));
    // Act
    show();
    // Assert
    expect(await screen.findByText('Este servicio todavía no tiene cobranza.')).toBeInTheDocument();
  });
});
