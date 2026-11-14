import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BotCardView } from './BotCardView';
import { CardCommandContext, OrderCardContext } from './botBlocks/cardCommand';
import { VisitActionContext } from '../spaces/visits/visitActionContext';

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

  // José 13/11 («la tarjeta sigue pésimo»), Stitch gst-01: the status beside the title squeezed «S/ 500.00 · Ferretería».
  it('the status rides the kicker line and the expense actions stack', () => {
    const expense = { kicker: 'Gasto · Yape', title: 'S/ 500.00 · Ferretería El Constructor', status: { label: 'Por completar', tone: 'warn' as const }, fields: [], actions: [{ id: 'complete', label: 'Completar gasto', style: 'primary' as const, value: 'g1' }, { id: 'discard', label: 'Descartar', style: 'secondary' as const, value: 'g1' }] };
    render(<BotCardView card={expense} chatId="c1" seq={7} jwt="jwt" />);
    expect(screen.getByTestId('tarjeta-estado').parentElement?.textContent).toContain('Gasto · Yape');
    expect(screen.getByTestId('tarjeta-acciones-apiladas')).toBeTruthy();
    expect(screen.getByTestId('accion-tarjeta-complete').className).toContain('w-full');
  });

  it('approve and reject stay side by side', () => {
    render(<BotCardView card={card} chatId="c1" seq={7} jwt="jwt" />);
    expect(screen.queryByTestId('tarjeta-acciones-apiladas')).toBeNull();
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

/** Design gst-02: the form shows the voucher it was opened from, so the card hands itself over with the button. */
describe('a card button that runs a command', () => {
  const voucher = { kicker: 'Gasto', title: 'S/ 500.00 · Ferretería El Constructor', status: { label: 'Por completar', tone: 'warn' as const }, fields: [{ label: 'Medio', value: 'Yape' }], actions: [{ id: 'complete', label: 'Completar gasto', style: 'primary' as const, value: '', command: '/gastos completar 7' }] };

  it('runs the line with the card\'s seq and what the form shows of it', () => {
    // Arrange
    const run = vi.fn();
    render(<CardCommandContext.Provider value={run}><BotCardView card={voucher} chatId="c1" seq={7} jwt="jwt" /></CardCommandContext.Provider>);
    // Act
    fireEvent.click(screen.getByTestId('accion-tarjeta-complete'));
    // Assert
    expect(run).toHaveBeenCalledWith('/gastos completar 7', 7, { kicker: 'Gasto', figure: 'S/ 500.00', title: 'Ferretería El Constructor', status: { label: 'Por completar', tone: 'warn' }, fields: [{ label: 'Medio', value: 'Yape' }] });
  });
});

// José 13/11 (thread, 400 px): «GASTO» broke into «GAS / TO» beside «Actualizado» and the pill; «Revisar gasto» into two lines.
describe('a card in a narrow thread', () => {
  const review = {
    kicker: 'Gasto',
    title: 'S/ 150.00 · Ferretería QA',
    updatedAt: '2026-11-13T19:36:00-05:00',
    status: { label: 'Posible duplicado', tone: 'warn' as const },
    fields: [],
    actions: [{ id: 'gasto_aprobar', label: 'Aprobar', style: 'primary' as const, value: 'g1' }, { id: 'gasto_editar', label: 'Revisar gasto', style: 'secondary' as const, value: 'g1' }, { id: 'gasto_descartar', label: 'Descartar', style: 'danger' as const, value: 'g1' }],
  };

  it('the head wraps its pieces instead of squeezing the kicker letter by letter', () => {
    render(<BotCardView card={review} chatId="c1" seq={7} jwt="jwt" />);
    const head = screen.getByTestId('tarjeta-cabecera');
    expect(head.className).toContain('flex-wrap');
    expect(screen.getByText('Gasto').className).not.toContain('flex-1');
  });

  it('three buttons keep each label on one line and wrap into rows when they do not fit', () => {
    render(<BotCardView card={review} chatId="c1" seq={7} jwt="jwt" />);
    for (const id of ['gasto_aprobar', 'gasto_editar', 'gasto_descartar']) {
      const button = screen.getByTestId(`accion-tarjeta-${id}`);
      expect(button.className).toContain('whitespace-nowrap');
      expect(button.className).not.toContain('flex-1');
    }
  });
});

/** José 13/11, a quote card in #admin: «al dar click en ver pdf debió abrir el visor». */
describe('a card link that is a file', () => {
  it('«Ver PDF» opens Lilachat\'s PDF viewer, not a new tab', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200, headers: { 'Content-Type': 'application/pdf' } })));
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const quote = { kicker: 'COTIZACIÓN NUEVA', title: 'Cotización COT - 0000318', fields: [], link: { label: 'Ver PDF', url: 'https://portal.example.com/api/public/quote-pdf/318', style: 'button' as const, mime: 'application/pdf' } };
    render(<BotCardView card={quote} chatId="c1" seq={9} jwt="jwt" />);
    // Act
    fireEvent.click(screen.getByRole('button', { name: /Ver PDF/ }));
    // Assert
    await waitFor(() => expect(screen.queryByTestId('pdf-visor') ?? screen.queryByTestId('pdf-preparando')).toBeTruthy());
    expect(opened).not.toHaveBeenCalled();
  });
  it('a page keeps opening in a new tab', () => {
    render(<BotCardView card={{ title: 'Cubicaje', fields: [], link: { label: 'Abrir cubicaje', url: 'https://inframaq.example.com/cubicaje?t=1' } }} chatId="c1" seq={10} jwt="jwt" />);
    expect(screen.getByRole('link', { name: /Abrir cubicaje/ }).getAttribute('target')).toBe('_blank');
  });
});

/** The visit card lv01 (agentes 14/11): its buttons open Lilachat's screens, never reach the app. */
describe('a technical visit card', () => {
  const visitCard = { kicker: 'VISITA TÉCNICA · VIS-2026-0014', title: 'Condominio Los Álamos', fields: [], actions: [{ id: 'visita_marcar_punto', label: 'Marcar punto', style: 'primary' as const, value: '65f0000000000000000000a1' }, { id: 'visita_entrevista', label: 'Entrevista', style: 'secondary' as const, value: '65f0000000000000000000a1' }] };
  it('«Entrevista» opens the visit\'s interview and posts nothing to the app', () => {
    // Arrange
    const open = vi.fn();
    const post = vi.spyOn(globalThis, 'fetch');
    render(<VisitActionContext.Provider value={open}><BotCardView card={visitCard} chatId="c1" seq={7} jwt="jwt" visitId="65f0000000000000000000a1" /></VisitActionContext.Provider>);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Entrevista' }));
    // Assert
    expect(open).toHaveBeenCalledWith('65f0000000000000000000a1', 'interview');
    expect(post).not.toHaveBeenCalled();
  });
  it('without the visit\'s id the button stays the app\'s', async () => {
    const open = vi.fn();
    const post = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    render(<VisitActionContext.Provider value={open}><BotCardView card={visitCard} chatId="c1" seq={7} jwt="jwt" /></VisitActionContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Entrevista' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(open).not.toHaveBeenCalled();
  });
});
