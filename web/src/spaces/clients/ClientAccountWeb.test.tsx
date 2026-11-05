import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientAccountWeb } from './ClientAccountWeb';

/** José 30/10: «¿dónde veo las cotizaciones del cliente?» (design f-08, `client.account.requested`). */
afterEach(() => vi.unstubAllGlobals());
const target = { jwt: 'jwt', spaceId: 's1', clientId: 'cli-carceli' };
const reply = (body: object) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const account = {
  client: { id: 'cli-carceli', name: 'CARCELI SAC' },
  quotes: [{ id: 'q1', code: '313', date: '2026-08-28', total: 168050.71, status: { label: 'Borrador', tone: 'neutral' }, items: [{ name: 'Mezcla asfáltica', quantity: 10, unit: 'm³', total: 3200 }] }],
  creditOrders: [
    { id: 'o2', product: 'Imprimación', dueAt: '2099-01-10', pending: 3000, status: { label: 'Pendiente', tone: 'warn' } },
    { id: 'o1', product: 'MAC 2', dueAt: '2020-01-01', pending: 8000, status: { label: 'Despachado', tone: 'ok' } },
  ],
  pending: 11000,
  totals: { quotes: 12, creditOrders: 2 },
};

describe('ClientAccountWeb', () => {
  it('asks for the account; overdue first with what is owed; the summary adds the overdue', async () => {
    // Arrange
    const fetchMock = reply({ account });
    vi.stubGlobal('fetch', fetchMock);
    // Act
    render(<ClientAccountWeb target={target} />);
    // Assert
    expect(await screen.findByTestId('resumen-cuenta')).toHaveTextContent('S/ 11,000.00');
    expect(screen.getByTestId('resumen-cuenta')).toHaveTextContent('Monto vencidoS/ 8,000.00');
    const rows = screen.getAllByTestId(/^credito-/);
    expect(rows.map((row) => row.dataset.testid)).toEqual(['credito-o1', 'credito-o2']);
    expect(rows[0]).toHaveTextContent('Debe S/ 8,000.00');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/api/workspaces/s1/clients/cli-carceli/account');
  });

  it('a quote opens with its line items, inside Lilachat', async () => {
    vi.stubGlobal('fetch', reply({ account }));
    render(<ClientAccountWeb target={target} />);
    fireEvent.click(await screen.findByTestId('cotizacion-q1'));
    expect(within(screen.getByTestId('ficha-registro')).getByText('Mezcla asfáltica')).toBeInTheDocument();
    expect(screen.getByTestId('ficha-registro')).toHaveTextContent('S/ 3,200.00');
  });

  it('services to collect go before the orders, overdue first, and count in the summary (José, 05/11: it said S/ 0.00)', async () => {
    // Arrange
    const services = [
      { id: 's2', name: 'Imprimación', pending: 500, isCredit: true, dueAt: '2099-01-10' },
      { id: 's1', name: 'Asfaltado Av. Lima', total: 90000, collected: 40000, pending: 50000, isCredit: true, dueAt: '2020-01-01' },
    ];
    vi.stubGlobal('fetch', reply({ account: { ...account, services, totals: { ...account.totals, services: 2 } } }));
    // Act
    render(<ClientAccountWeb target={target} />);
    // Assert
    const section = await screen.findByTestId('servicios-por-cobrar');
    expect(section).toHaveTextContent('Servicios por cobrar · 2');
    expect(screen.getAllByTestId(/^servicio-por-cobrar-/).map((row) => row.dataset.testid)).toEqual(['servicio-por-cobrar-s1', 'servicio-por-cobrar-s2']);
    expect(screen.getByTestId('servicio-por-cobrar-s1')).toHaveTextContent('Total S/ 90,000.00 · Cobrado S/ 40,000.00');
    expect(screen.getByTestId('servicio-por-cobrar-s1')).toHaveTextContent('Debe S/ 50,000.00');
    expect(section.compareDocumentPosition(screen.getByTestId('credito-o1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('resumen-cuenta')).toHaveTextContent('Monto vencidoS/ 58,000.00');
    expect(screen.getByTestId('resumen-cuenta')).toHaveTextContent('4 al crédito');
  });

  it('without `services` the section is not there', async () => {
    vi.stubGlobal('fetch', reply({ account }));
    render(<ClientAccountWeb target={target} />);
    await screen.findByTestId('resumen-cuenta');
    expect(screen.queryByTestId('servicios-por-cobrar')).not.toBeInTheDocument();
  });

  it('services alone are enough to show the account', async () => {
    vi.stubGlobal('fetch', reply({ account: { client: account.client, services: [{ id: 's1', name: 'Asfaltado', pending: 900, isCredit: false }], pending: 900, totals: {} } }));
    render(<ClientAccountWeb target={target} />);
    expect(await screen.findByTestId('resumen-cuenta')).toHaveTextContent('S/ 900.00');
    expect(screen.getByTestId('servicio-por-cobrar-s1')).toHaveTextContent('Debe S/ 900.00');
  });

  it('an order from another year says it (Loroña’s «28 oct» was from 2025)', async () => {
    const old = { id: 'o9', product: 'MAC 2', date: '2020-10-28', pending: 100, status: { label: 'Pendiente', tone: 'warn' } };
    vi.stubGlobal('fetch', reply({ account: { ...account, creditOrders: [old] } }));
    render(<ClientAccountWeb target={target} />);
    expect(await screen.findByTestId('credito-o9')).toHaveTextContent('28 oct 2020');
  });

  it('when Portal sends neither list, it says that person may not see it', async () => {
    vi.stubGlobal('fetch', reply({ account: { client: { id: 'c', name: 'C' }, totals: {} } }));
    render(<ClientAccountWeb target={target} />);
    expect(await screen.findByText('No tienes permiso para ver la cuenta de este cliente.')).toBeInTheDocument();
  });
});
