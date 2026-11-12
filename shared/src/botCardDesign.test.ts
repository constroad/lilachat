import { describe, expect, it } from 'vitest';
import { validateBotCard } from './bots.js';
import { isFigure, validateBotBlocks } from './botBlocks.js';

/**
 * Inframaq's consumption card (Stitch a10, José 12/11, through agentes): a colored bar, a subtitle,
 * the whole card as a link with a solid button, a footer, an inset figure, section headers,
 * a fuel as one line (name · rate · total), materials as tiles, and a corrected value struck through.
 */
const registered = {
  kicker: 'Consumo de planta',
  title: 'Obra Las Lomas',
  status: { label: 'Registrado', tone: 'ok' },
  accent: 'brand',
  subtitle: 'Consorcio Lomas',
  url: 'https://inframaq.constroad.com/consumos/6a9f',
  link: { label: 'Ver consumo', url: 'https://inframaq.constroad.com/consumos/6a9f', style: 'button' },
  footer: 'Registró Wilson Zamora · 9:28',
  blocks: [
    { type: 'stat', caption: 'Lecturas · mié 11 nov · 02:46 → 13:54', label: 'Producción', value: '268,00', unit: 'm³' },
    { type: 'section', title: 'Combustible', aside: 'Consumo total en planta' },
    { type: 'rows', rows: [{ label: 'PEN', mid: '24,43 gl/m³', value: '6 546,59 gl' }] },
    { type: 'section', title: 'Agregados · Globofast Solkali', aside: '268,00 m³' },
    { type: 'tiles', items: [{ label: 'Arena primaria', value: '93,80 m³' }, { label: 'Grava 6/7', value: '67,00 m³' }] },
  ],
};

describe('the consumption card of Stitch a10', () => {
  it('keeps the bar, subtitle, link of the whole card, solid button and footer', () => {
    // Act
    const checked = validateBotCard(registered);
    // Assert
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.card).toMatchObject({ accent: 'brand', subtitle: 'Consorcio Lomas', url: registered.url, footer: 'Registró Wilson Zamora · 9:28', link: { label: 'Ver consumo', url: registered.url, style: 'button' } });
  });

  it('keeps the inset figure, the section headers, the fuel line and the tiles', () => {
    const checked = validateBotCard(registered);
    if (!checked.ok) throw new Error(checked.message);
    expect(checked.card.blocks).toEqual([
      { type: 'stat', caption: 'Lecturas · mié 11 nov · 02:46 → 13:54', label: 'Producción', value: '268,00', unit: 'm³' },
      { type: 'section', title: 'Combustible', aside: 'Consumo total en planta' },
      { type: 'rows', rows: [{ label: 'PEN', mid: '24,43 gl/m³', value: '6 546,59 gl', tone: 'neutral' }] },
      { type: 'section', title: 'Agregados · Globofast Solkali', aside: '268,00 m³' },
      { type: 'tiles', items: [{ label: 'Arena primaria', value: '93,80 m³' }, { label: 'Grava 6/7', value: '67,00 m³' }] },
    ]);
  });

  it('a corrected value keeps the one before it', () => {
    const checked = validateBotBlocks([{ type: 'rows', rows: [{ label: 'Arena primaria', before: '268,00', value: '261,50 m³', tone: 'warn' }] }], 8);
    expect(checked).toEqual({ ok: true, blocks: [{ type: 'rows', rows: [{ label: 'Arena primaria', before: '268,00', value: '261,50 m³', tone: 'warn' }] }] });
  });

  it('an accent of its own, or a link that is not https, is not drawn; the card is refused for the link', () => {
    const odd = validateBotCard({ ...registered, accent: '#c8a200' });
    expect(odd.ok && odd.card.accent).toBe(undefined);
    expect(validateBotCard({ ...registered, url: 'http://inframaq.constroad.com/consumos/6a9f' })).toEqual({ ok: false, message: 'El enlace de la tarjeta debe empezar con https://.' });
  });

  it('too long is cut at a whole word, never mid-word and never with «…»', () => {
    const subtitle = 'Consorcio Lomas · despacho editado por Ana Torres desde Portal después de revisar las lecturas del medidor de combustible de la planta';
    const checked = validateBotCard({ ...registered, subtitle });
    if (!checked.ok) throw new Error(checked.message);
    expect(checked.card.subtitle!.length).toBeLessThanOrEqual(120);
    expect(subtitle.startsWith(checked.card.subtitle!)).toBe(true);
    expect(subtitle[checked.card.subtitle!.length]).toBe(' ');
    expect(checked.card.subtitle).not.toContain('…');
  });

  it('a figure without its value, a section without its title, and empty tiles are refused', () => {
    expect(validateBotBlocks([{ type: 'stat', label: 'Producción' }], 8)).toEqual({ ok: false, message: 'La cifra necesita etiqueta y valor.' });
    expect(validateBotBlocks([{ type: 'section', aside: '268,00 m³' }], 8)).toEqual({ ok: false, message: 'La sección necesita un título.' });
    expect(validateBotBlocks([{ type: 'tiles', items: [{ label: '', value: '' }] }], 8)).toEqual({ ok: false, message: 'Las casillas necesitan etiqueta y valor.' });
  });

  it('up to 12 tiles', () => {
    const items = Array.from({ length: 15 }, (_, index) => ({ label: `Material ${index + 1}`, value: `${index} m³` }));
    const checked = validateBotBlocks([{ type: 'tiles', items }], 8);
    expect(checked.ok && checked.blocks[0]?.type === 'tiles' && checked.blocks[0].items.length).toBe(12);
  });

  it('an aside that starts with a number is a figure; words are a note', () => {
    expect(['268,00 m³', '−6,08 gl', '+12 gl'].map(isFigure)).toEqual([true, true, true]);
    expect(['Consumo total en planta', 'm³ 12'].map(isFigure)).toEqual([false, false]);
  });
});
