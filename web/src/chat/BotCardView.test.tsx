import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BotCardView } from './BotCardView';
import { OrderCardContext } from './botBlocks/cardCommand';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const card = {
  kicker: 'PORTAL · PEDIDOS',
  title: '¿Confirmas el pedido 1024?',
  status: { label: 'Por confirmar', tone: 'warn' as const },
  fields: [{ label: 'Cliente', value: 'Obra Miraflores' }, { label: 'm³', value: '12' }],
  link: { label: 'Ver en Portal', url: 'https://portal.example.com/pedidos/1024' },
  actions: [{ id: 'confirm', label: 'Confirmar', style: 'primary' as const, value: 'p-77' }, { id: 'cancel', label: 'Cancelar', style: 'danger' as const, value: 'p-77' }],
};

/** A bot's card (`specs/BOTS-API.spec.md` §b), as the web draws it. */
describe('bot card', () => {
  it('draws the kicker, title, status, fields and link', () => {
    render(<BotCardView card={card} chatId="c1" seq={7} jwt="jwt" />);
    expect(screen.getByText('PORTAL · PEDIDOS')).toBeTruthy();
    expect(screen.getByText('Por confirmar')).toBeTruthy();
    expect(screen.getByText('Obra Miraflores')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ver en Portal/ }).getAttribute('href')).toBe('https://portal.example.com/pedidos/1024');
  });

  // Agentes, 24/10: «Registró: Lilachat · (51902049…)» came cut on one line. Stitch a10 (12/11): no clamp either.
  it('a long field value wraps whole, never cut nor clamped', () => {
    const long = 'Lilachat · (51902049935) · José Zamora';
    render(<BotCardView card={{ title: 'Asistencia', fields: [{ label: 'Registró', value: long }] }} chatId="c1" seq={7} jwt="jwt" />);
    const value = screen.getByText(long);
    expect(value.className).not.toMatch(/line-clamp|truncate/);
    expect(value.className).toContain('break-words');
  });

  it('a tap on an action reaches the bot, and the buttons say it was sent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 202 }));
    render(<BotCardView card={card} chatId="c1" seq={7} jwt="jwt" />);
    fireEvent.click(screen.getByTestId('accion-tarjeta-confirm'));
    await waitFor(() => expect(screen.getByTestId('accion-tarjeta-confirm').textContent).toContain('Enviado'));
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/c1/card-actions', expect.objectContaining({ method: 'POST', body: JSON.stringify({ seq: 7, action_id: 'confirm' }) }));
    expect((screen.getByTestId('accion-tarjeta-cancel') as HTMLButtonElement).disabled).toBe(true);
  });

  it('if the tap does not go out, it says so and can be tried again', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'La app de esa tarjeta ya no está instalada.' }), { status: 404 }));
    render(<BotCardView card={card} chatId="c1" seq={7} jwt="jwt" />);
    fireEvent.click(screen.getByTestId('accion-tarjeta-confirm'));
    expect(await screen.findByText('La app de esa tarjeta ya no está instalada.')).toBeTruthy();
    expect((screen.getByTestId('accion-tarjeta-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a closed card (no actions) has no buttons', () => {
    render(<BotCardView card={{ title: 'Pedido 1024', status: { label: 'Confirmado por José', tone: 'ok' }, fields: [] }} chatId="c1" seq={7} jwt="jwt" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/** José 06/11: the order's card reaches the channel and there was nothing to tap to see the dispatch's photos. */
describe('an order\'s card in a client\'s channel', () => {
  const order = { kicker: 'PEDIDO', title: '30 m³ · Diseño MAC-2 certificado', fields: [] };

  it('opens the order with the seq of its message', () => {
    // Arrange
    const open = vi.fn();
    render(<OrderCardContext.Provider value={open}><BotCardView card={order} chatId="c1" seq={10} jwt="jwt" /></OrderCardContext.Provider>);
    // Act
    fireEvent.click(screen.getByTestId('tarjeta-ver-pedido'));
    // Assert
    expect(screen.getByTestId('tarjeta-ver-pedido').textContent).toContain('Ver despachos y fotos');
    expect(open).toHaveBeenCalledWith(10);
  });

  it('any other card, or a chat that is not a client\'s, shows no such button', () => {
    // Arrange and act
    render(<OrderCardContext.Provider value={vi.fn()}><BotCardView card={{ ...order, kicker: 'INFORME' }} chatId="c1" seq={10} jwt="jwt" /></OrderCardContext.Provider>);
    render(<BotCardView card={order} chatId="c1" seq={10} jwt="jwt" />);
    // Assert
    expect(screen.queryByTestId('tarjeta-ver-pedido')).toBeNull();
  });

  it('an answer that is not stored has no message to look up', () => {
    render(<OrderCardContext.Provider value={vi.fn()}><BotCardView card={order} chatId="c1" seq={0} jwt="jwt" /></OrderCardContext.Provider>);
    expect(screen.queryByTestId('tarjeta-ver-pedido')).toBeNull();
  });
});
