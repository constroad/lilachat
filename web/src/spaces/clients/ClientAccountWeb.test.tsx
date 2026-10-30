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

  it('when Portal sends neither list, it says that person may not see it', async () => {
    vi.stubGlobal('fetch', reply({ account: { client: { id: 'c', name: 'C' }, totals: {} } }));
    render(<ClientAccountWeb target={target} />);
    expect(await screen.findByText('No tienes permiso para ver la cuenta de este cliente.')).toBeInTheDocument();
  });
});
