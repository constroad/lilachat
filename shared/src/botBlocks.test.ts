import { describe, expect, it } from 'vitest';
import { barColumns, barFractions, linePath, tankFill, validateBotBlocks, BLOCK_LIMITS } from './botBlocks.js';
import { validateBotCard } from './bots.js';

/** The card kit (§118.4, José 23/10): what agents and webhooks can draw in a card, validated once for server, app and web. */
describe('bot card blocks', () => {
  it('keeps a liquids card: a tank, a bar chart with its threshold and a line of context', () => {
    const result = validateBotBlocks([
      { type: 'tank', items: [{ name: 'GRUPO WILSON', level: 0.81, min: 0.2, value: '81 cm', sub: '50 gl disponibles', delta: '−0,06 gl', tone: 'ok' }] },
      { type: 'chart', kind: 'bar-h', unit: 'm³', points: [{ label: 'INFRA PEN 1', value: 92, tone: 'ok' }, { label: 'INFRA PEN 2', value: 18, tone: 'error', note: 'Bajo' }], threshold: { value: 20, label: 'mín' } },
      { type: 'text', text: '1 tanque bajo el mínimo', tone: 'error' },
    ], BLOCK_LIMITS.cardBlocks);
    expect(result).toMatchObject({ ok: true, blocks: [{ type: 'tank' }, { type: 'chart', kind: 'bar-h', points: [{ label: 'INFRA PEN 1', value: 92 }, { label: 'INFRA PEN 2', note: 'Bajo' }] }, { type: 'text' }] });
  });

  it('clamps what would draw outside the card and drops what is not a block', () => {
    const result = validateBotBlocks([{ type: 'tank', items: [{ name: 'T', level: 1.7, value: 'x' }] }, { type: 'progress', value: 20, max: 15, label: 'Ingresos' }, { type: 'nada' }], BLOCK_LIMITS.cardBlocks);
    expect(result).toMatchObject({ ok: true, blocks: [{ type: 'tank', items: [{ level: 1, tone: 'neutral' }] }, { type: 'progress', value: 15, max: 15 }] });
  });

  it('refuses what cannot be drawn honestly, with the reason', () => {
    expect(validateBotBlocks([{ type: 'chart', kind: 'pie', points: [{ label: 'a', value: 1 }] }], 8)).toMatchObject({ ok: false, message: expect.stringContaining('bar-h') });
    expect(validateBotBlocks([{ type: 'chart', kind: 'bar-v', points: [{ label: 'a', value: Number.NaN }] }], 8)).toMatchObject({ ok: false });
    expect(validateBotBlocks([{ type: 'attachments', count: 3, url: 'http://inseguro' }], 8)).toMatchObject({ ok: false, message: expect.stringContaining('https') });
    expect(validateBotBlocks(Array.from({ length: 9 }, () => ({ type: 'text', text: 'x' })), 8)).toMatchObject({ ok: false });
  });

  it('a card carries its blocks, its detail for the sheet and when it was updated', () => {
    const card = validateBotCard({ kicker: 'LÍQUIDOS · INFRAMAQ', title: 'Estado de stock en 7 tanques', fields: [], blocks: [{ type: 'metric', value: '81 cm', label: 'GRUPO WILSON' }], detail: { title: 'Control de tanques', blocks: [{ type: 'rows', rows: [{ label: '08:33 · Darío Paredes', value: '−0,06 gl' }] }] }, updated_at: '2026-10-23T22:30:00.000Z' });
    expect(card).toMatchObject({ ok: true, card: { blocks: [{ type: 'metric' }], detail: { title: 'Control de tanques', blocks: [{ type: 'rows' }] }, updatedAt: '2026-10-23T22:30:00.000Z' } });
  });

  it('a card too heavy for a chat is refused: a report is a link, not a card', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ label: `Fila ${i} ${'x'.repeat(38)}`, value: 'y'.repeat(110), sub: 'z'.repeat(110) }));
    const detail = { title: 'T', blocks: Array.from({ length: 12 }, () => ({ type: 'rows', rows })) };
    expect(validateBotCard({ title: 'T', fields: [], detail })).toMatchObject({ ok: false, message: expect.stringContaining('KB') });
  });

  it('draws the same in the app and on the web: bar fractions, a line and a tank fill', () => {
    expect(barFractions([{ value: 92 }, { value: 18 }, { value: 0 }])).toEqual([1, 18 / 92, 0]);
    expect(barFractions([{ value: 5 }], 10)).toEqual([0.5]);
    expect(linePath([95, 90, 85], 100, 50)).toBe('M0,0 L50,25 L100,50');
    expect(linePath([7], 100, 50)).toBe('M0,25 L100,25');
    expect(tankFill(0.81, 100)).toEqual({ y: 19, height: 81 });
  });

  it('fits a week of vertical bars in a phone card and scrolls a month (José, 23/10: «Sá 27» was cut)', () => {
    // Arrange: a card about 300 wide, 7 days, then 31 days, then no width measured yet.
    const week = barColumns(300, 7);
    const month = barColumns(300, 31);
    // Assert
    expect(week.scroll).toBe(false);
    expect(week.column * 7).toBeLessThanOrEqual(300);
    expect(week.bar).toBeLessThan(week.column);
    expect(month.scroll).toBe(true);
    expect(month.column * 31).toBeGreaterThan(300);
    expect(barColumns(300, 2).bar).toBe(32);
    expect(barColumns(0, 7)).toMatchObject({ scroll: false });
    expect(barColumns(300, 0)).toMatchObject({ scroll: false, column: 0 });
  });
});
