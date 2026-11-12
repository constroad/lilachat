import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { BotCard } from '@lilachat/shared';
import { BotCardView } from './BotCardView';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const URL_OF_CONSUMPTION = 'https://inframaq.constroad.com/consumos/6a9f';

/** Inframaq's consumption card as agentes sends it after Stitch a10 (José, 12/11). */
const registered: BotCard = {
  kicker: 'Consumo de planta',
  title: 'Obra Las Lomas',
  status: { label: 'Registrado', tone: 'ok' },
  accent: 'brand',
  subtitle: 'Consorcio Lomas',
  url: URL_OF_CONSUMPTION,
  fields: [],
  link: { label: 'Ver consumo', url: URL_OF_CONSUMPTION, style: 'button' },
  footer: 'Registró Wilson Zamora · 9:28',
  actions: [{ id: 'corregir', label: 'Corregir', style: 'secondary', value: 'c-1' }],
  blocks: [
    { type: 'stat', caption: 'Lecturas · mié 11 nov · 02:46 → 13:54', label: 'Producción', value: '268,00', unit: 'm³' },
    { type: 'section', title: 'Combustible', aside: 'Consumo total en planta' },
    { type: 'rows', rows: [{ label: 'PEN', mid: '24,43 gl/m³', value: '6 546,59 gl', tone: 'neutral' }] },
    { type: 'section', title: 'Agregados · Globofast Solkali', aside: '268,00 m³' },
    { type: 'tiles', items: [{ label: 'Arena primaria', value: '93,80 m³' }, { label: 'Grava 6/7', value: '67,00 m³' }] },
    { type: 'rows', rows: [{ label: 'Arena secundaria', before: '268,00', value: '261,50 m³', tone: 'warn' }] },
  ],
};
const draw = (card: BotCard = registered) => render(<BotCardView card={card} chatId="c1" seq={7} jwt="jwt" />);

describe('the consumption card of Stitch a10 on the web', () => {
  it('draws the brand bar, the subtitle and the footer with the solid «Ver consumo» button', () => {
    // Act
    draw();
    // Assert
    expect(screen.getByTestId('tarjeta-acento').className).toContain('bg-primary-brand');
    expect(screen.getByTestId('tarjeta-subtitulo').textContent).toBe('Consorcio Lomas');
    const footer = screen.getByTestId('tarjeta-pie');
    expect(within(footer).getByText('Registró Wilson Zamora · 9:28')).toBeTruthy();
    const button = within(footer).getByRole('link', { name: /Ver consumo/ });
    expect(button.getAttribute('href')).toBe(URL_OF_CONSUMPTION);
    expect(button.className).toContain('bg-primary');
  });

  it('a corrected card carries the warn bar', () => {
    draw({ ...registered, accent: 'warn', status: { label: 'Corregido desde Portal', tone: 'warn' } });
    expect(screen.getByTestId('tarjeta-acento').className).toContain('bg-warning');
  });

  it('draws the inset figure, the section headers, the fuel line, the tiles and the struck value', () => {
    draw();
    const stat = screen.getByTestId('bloque-estadistica');
    expect(stat.textContent).toContain('Lecturas · mié 11 nov · 02:46 → 13:54');
    expect(stat.textContent).toContain('Producción');
    expect(stat.textContent).toContain('268,00m³');
    const sections = screen.getAllByTestId('bloque-seccion');
    expect(sections.map((one) => one.textContent)).toEqual(['CombustibleConsumo total en planta', 'Agregados · Globofast Solkali268,00 m³']);
    expect(within(sections[1]!).getByText('268,00 m³').className).toContain('font-bold');
    expect(screen.getByTestId('fila-medio').textContent).toBe('24,43 gl/m³');
    expect(screen.getByTestId('bloque-casillas').className).toContain('grid-cols-2');
    expect(screen.getByTestId('fila-antes').tagName).toBe('S');
  });

  it('a tap on the body opens the consumption; a tap on a button does not', () => {
    // Arrange
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    draw();
    // Act
    fireEvent.click(screen.getByText('Combustible'));
    fireEvent.click(screen.getByTestId('accion-tarjeta-corregir'));
    // Assert
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(URL_OF_CONSUMPTION, '_blank', 'noopener,noreferrer');
    expect(screen.getByTestId('tarjeta-titulo').getAttribute('href')).toBe(URL_OF_CONSUMPTION);
  });

  it('no text of the card is cut with «…» nor clamped', () => {
    draw();
    const card = screen.getByTestId('tarjeta-bot');
    const cut = [...card.querySelectorAll('*')].filter((node) => /\b(truncate|line-clamp-\d)\b/.test(node.getAttribute('class') ?? ''));
    expect(cut).toEqual([]);
  });

  it('a card from before draws as it did: text link, no bar, no footer', () => {
    draw({ title: 'Pedido 1024', fields: [], link: { label: 'Ver en Portal', url: 'https://www.constroad.com/pedidos/1024' } });
    expect(screen.queryByTestId('tarjeta-acento')).toBeNull();
    expect(screen.queryByTestId('tarjeta-pie')).toBeNull();
    expect(screen.getByRole('link', { name: /Ver en Portal/ }).className).not.toContain('bg-primary');
  });
});
