import { describe, expect, it } from 'vitest';
import { barColumns, barFractions, linePath, peopleOnCard, peoplePhotos, personEvidence, personTime, tankDeltaTrend, tankFill, tankPercent, validateBotBlocks, BLOCK_LIMITS, PEOPLE_ON_CARD, cardCommandsOf, rowIsForAnyone, galleryFiles, galleryStrip, type BotBlock } from './botBlocks.js';
import { validateBotCard } from './bots.js';

/** The card kit (§118.4, José 23/10): what agents and webhooks can draw in a card, validated once for server, app and web. */
describe('the level of a tank (José, 04/11: «dice el delta pero la gráfica parece llena»)', () => {
  it('draws a third of a tank as a third, and the percent says the same', () => {
    expect(tankFill(0.32, 76)).toEqual({ y: 52, height: 24 });
    expect(tankPercent(0.32)).toBe('32 %');
  });
});

describe('people on a card (José, 04/11: «¿sirve solo ver las iniciales?»)', () => {
  it('keeps the first ones on the card and counts the rest with what the app already counted', () => {
    const names = Array.from({ length: PEOPLE_ON_CARD + 4 }, (_, index) => `Persona ${index}`);
    const shown = peopleOnCard({ names, more: 3 });
    expect(shown.names).toHaveLength(PEOPLE_ON_CARD);
    expect(shown.more).toBe(7);
  });

  it('counts nothing when everybody fits', () => {
    expect(peopleOnCard({ names: ['Ana Díaz'] })).toEqual({ names: ['Ana Díaz'], more: 0 });
  });

  it('accepts the whole crew, because the detail lists everybody', () => {
    const names = Array.from({ length: BLOCK_LIMITS.people + 5 }, (_, index) => `Persona ${index}`);
    const result = validateBotBlocks([{ type: 'people', names }], BLOCK_LIMITS.detailBlocks);
    expect(BLOCK_LIMITS.people).toBeGreaterThanOrEqual(BLOCK_LIMITS.rows);
    expect(result).toMatchObject({ ok: true, blocks: [{ type: 'people', names: names.slice(0, BLOCK_LIMITS.people) }] });
  });
});

describe('the tank as the r155 design shows it (José, 24/10: like Portal\'s WhatsApp report)', () => {
  it('keeps the verdict in words and writes the fill as a percent', () => {
    const result = validateBotBlocks([{ type: 'tank', items: [{ name: 'INFRA PEN 2', level: 0.22, min: 0.25, value: '35 cm', sub: '18 m³ prod. disponibles', status: 'Bajo', tone: 'error' }] }], BLOCK_LIMITS.cardBlocks);
    expect(result).toMatchObject({ ok: true, blocks: [{ type: 'tank', items: [{ status: 'Bajo', tone: 'error' }] }] });
    expect([tankPercent(0.804), tankPercent(1.4), tankPercent(-1)]).toEqual(['80 %', '100 %', '0 %']);
  });
});

describe('tapping a tank opens its detail (José, 24/10)', () => {
  it('keeps each tank\'s detail as blocks; a tank inside it opens nothing more; an empty or broken detail is dropped', () => {
    // Arrange
    const tank = { name: 'INFRA PEN #1', level: 0.84, min: 0.2, value: '84 cm', tone: 'ok' };
    const detail = { title: 'INFRA PEN #1', blocks: [{ type: 'tank', items: [{ ...tank, detail: { blocks: [{ type: 'text', text: 'loop' }] } }] }, { type: 'rows', rows: [{ label: 'Disponible', value: '2589,1 gl' }, { label: 'Última medida', value: '08:33 · Darío Paredes' }] }] };
    // Act
    const result = validateBotBlocks([{ type: 'tank', items: [{ ...tank, detail }, { ...tank, name: 'INFRA PEN #2', detail: { blocks: [] } }, { ...tank, name: 'INFRA PEN #3', detail: { blocks: [{ type: 'chart', kind: 'pie', points: [] }] } }] }], BLOCK_LIMITS.cardBlocks);
    // Assert
    const items = result.ok && result.blocks[0]!.type === 'tank' ? result.blocks[0]!.items : [];
    expect(items[0]!.detail).toEqual({ title: 'INFRA PEN #1', blocks: [{ type: 'tank', items: [{ name: 'INFRA PEN #1', level: 0.84, min: 0.2, value: '84 cm', tone: 'ok' }] }, { type: 'rows', rows: [{ label: 'Disponible', value: '2589,1 gl', tone: 'neutral' }, { label: 'Última medida', value: '08:33 · Darío Paredes', tone: 'neutral' }] }] });
    expect(items[1]!.detail).toBeUndefined();
    expect(items[2]!.detail).toBeUndefined();
  });
});

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

/** José, 04/11: «en las asistencias no se ve la hora solo los nombres». */
describe('the time of each person', () => {
  const people = (raw: Record<string, unknown>) => {
    const result = validateBotBlocks([{ type: 'people', ...raw }], BLOCK_LIMITS.detailBlocks);
    if (!result.ok) throw new Error(result.message);
    return result.blocks[0] as Extract<(typeof result.blocks)[number], { type: 'people' }>;
  };

  it('each name keeps its time', () => {
    const block = people({ names: ['Carlos Dario', 'Jensen Stewen'], times: ['07:12', '07:40'] });
    expect(block.times).toEqual(['07:12', '07:40']);
    expect(personTime(block, 1)).toBe('07:40');
  });

  it('a blank name takes its time with it, so the rest stay with their person', () => {
    const block = people({ names: ['Carlos Dario', '  ', 'Jensen Stewen'], times: ['07:12', '07:20', '07:40'] });
    expect(block.names).toEqual(['Carlos Dario', 'Jensen Stewen']);
    expect(block.times).toEqual(['07:12', '07:40']);
  });

  it('someone without a time says nothing, and a short list leaves the rest without one', () => {
    const block = people({ names: ['Ana', 'Beto', 'Caro'], times: ['', '08:00'] });
    expect([personTime(block, 0), personTime(block, 1), personTime(block, 2)]).toEqual(['', '08:00', '']);
  });

  it('a block with no times stays as the installed apps know it', () => {
    expect(people({ names: ['Ana'] })).toEqual({ type: 'people', names: ['Ana'] });
    expect(people({ names: ['Ana'], times: ['', 7] })).toEqual({ type: 'people', names: ['Ana'] });
    expect(personTime({}, 0)).toBe('');
  });
});

/** José, 04/11: «el delta casi pasa desapercibido hacelo mas notorio». */
describe('which way a tank went', () => {
  it('a minus of any kind is down, a plus is up', () => {
    expect(tankDeltaTrend('−6,08 gl consumidos')).toBe('down');
    expect(tankDeltaTrend('-6.08 gl')).toBe('down');
    expect(tankDeltaTrend('+12 gl cargados')).toBe('up');
  });

  it('a text without a sign has no arrow', () => {
    expect(tankDeltaTrend('Sin cambios')).toBeNull();
  });
});

/** José, 04/11: «no podemos ver donde firmaron la asistencia los trabajadores. ni las fotos». */
describe('what backs a mark', () => {
  const photo = 'https://inframaq.constroad.com/api/public/marca/abc?sig=1';
  const map = 'https://maps.google.com/?q=-12.02,-77.02';
  const people = (raw: Record<string, unknown>) => {
    const result = validateBotBlocks([{ type: 'people', ...raw }], BLOCK_LIMITS.detailBlocks);
    if (!result.ok) throw new Error(result.message);
    return result.blocks[0] as Extract<(typeof result.blocks)[number], { type: 'people' }>;
  };

  it('each person keeps their photo and where they signed', () => {
    const block = people({ names: ['Carlos Dario', 'Jensen Stewen'], evidence: [{ photo, place: 'Planta Huachipa', map }, { place: 'Obra Ate' }] });
    expect(personEvidence(block, 0)).toEqual({ photo, place: 'Planta Huachipa', map });
    expect(personEvidence(block, 1)).toEqual({ place: 'Obra Ate' });
  });

  it('a blank name takes its evidence with it, so nobody shows the photo of another', () => {
    const block = people({ names: ['Ana', ' ', 'Beto'], evidence: [{ place: 'A' }, { place: 'B' }, { place: 'C' }] });
    expect(block.names).toEqual(['Ana', 'Beto']);
    expect(personEvidence(block, 1)).toEqual({ place: 'C' });
  });

  it('only an https link opens: anything else is dropped and the rest stays', () => {
    const block = people({ names: ['Ana'], evidence: [{ photo: 'http://x/a.jpg', map: 'javascript:alert(1)', place: 'Planta' }] });
    expect(personEvidence(block, 0)).toEqual({ place: 'Planta' });
  });

  it('a block with nothing to show stays as the installed apps know it', () => {
    expect(people({ names: ['Ana'], evidence: [{}, 'x'] })).toEqual({ type: 'people', names: ['Ana'] });
    expect(personEvidence({}, 0)).toEqual({});
  });

  it('the viewer swipes through those who have a photo, each with their name', () => {
    const block = people({ names: ['Ana', 'Beto', 'Caro'], evidence: [{ photo }, { place: 'Planta' }, { photo: `${photo}2` }] });
    expect(peoplePhotos(block)).toEqual([
      { url: photo, name: 'Foto de Ana', mime: 'image/jpeg' },
      { url: `${photo}2`, name: 'Foto de Caro', mime: 'image/jpeg' },
    ]);
  });
});

/** «Si toco un distrito no muestra el detalle» (José, 05/11): a row can carry the line a person would type. */
describe('a row with a command', () => {
  const rowsOf = (row: Record<string, unknown>) => {
    const checked = validateBotBlocks([{ type: 'rows', rows: [{ label: 'Ate', value: '24°', ...row }] }], BLOCK_LIMITS.detailBlocks);
    if (!checked.ok) throw new Error(checked.message);
    return checked.blocks[0] as Extract<BotBlock, { type: 'rows' }>;
  };

  it('keeps the line to run', () => {
    expect(rowsOf({ command: '/clima hoy en Ate' }).rows[0]).toMatchObject({ label: 'Ate', command: '/clima hoy en Ate' });
  });

  it('a row without one stays as it was', () => {
    expect(rowsOf({}).rows[0]).not.toHaveProperty('command');
  });

  it('what is not a slash line is dropped, and the row stays', () => {
    expect(rowsOf({ command: 'clima hoy' }).rows[0]).not.toHaveProperty('command');
    expect(rowsOf({ command: 42 }).rows[0]).not.toHaveProperty('command');
    expect(rowsOf({ command: '/' }).rows[0]).not.toHaveProperty('command');
  });
});

describe('cardCommandsOf', () => {
  const rows = (...commands: (string | undefined)[]): BotBlock => ({ type: 'rows', rows: commands.map((command, index) => ({ label: `Fila ${index}`, value: '1', tone: 'neutral' as const, ...(command ? { command } : {}) })) });

  it('reads the card and its detail, and skips rows without one', () => {
    const card = { blocks: [rows('/clima hoy en Lima', undefined)], detail: { blocks: [{ type: 'text' as const, text: 'x', tone: 'neutral' as const }, rows('/clima hoy en Ate')] } };
    expect(cardCommandsOf(card)).toEqual(['/clima hoy en Lima', '/clima hoy en Ate']);
  });

  it('a card with no blocks has none', () => {
    expect(cardCommandsOf({})).toEqual([]);
  });

  it('a button of the card counts too (José, 05/11: «Completar» on a card that lacks a piece of data)', () => {
    expect(cardCommandsOf({ actions: [{ command: '/gastos completar 7' }, {}] })).toEqual(['/gastos completar 7']);
  });
});

describe('rowIsForAnyone', () => {
  const card = { blocks: [{ type: 'rows' as const, rows: [{ label: 'Ate', value: '1', tone: 'neutral' as const, command: '/clima en Ate', anyone: true }, { label: 'Lima', value: '2', tone: 'neutral' as const, command: '/clima en Lima' }] }] };

  it('only the row the app opened, by its exact line', () => {
    expect(rowIsForAnyone(card, '/clima en Ate')).toBe(true);
    expect(rowIsForAnyone(card, '/clima en Lima')).toBe(false);
    expect(rowIsForAnyone(card, '/clima en Lurín')).toBe(false);
  });

  it('reads the detail too, and a button never opens anything', () => {
    expect(rowIsForAnyone({ detail: { blocks: card.blocks } }, '/clima en Ate')).toBe(true);
    expect(rowIsForAnyone({ actions: [{ command: '/clima en Ate' }] }, '/clima en Ate')).toBe(false);
  });

  it('the validator keeps it only on a row with a command, and only when it is true', () => {
    const valid = validateBotBlocks([{ type: 'rows', rows: [{ label: 'A', value: '1', command: '/clima a', anyone: true }, { label: 'B', value: '2', anyone: true }, { label: 'C', value: '3', command: '/clima c', anyone: 'yes' }] }]);
    if (!valid.ok) throw new Error(valid.message);
    const rows = valid.blocks[0]!.type === 'rows' ? valid.blocks[0]!.rows : [];
    expect(rows.map((row) => row.anyone)).toEqual([true, undefined, undefined]);
  });
});

/** Each unit's photos and videos on its root card in #planta (José via agentes, 09/11). */
describe('the gallery block', () => {
  const photo = { url: 'https://lila.constroad.com/files/a.jpg', thumb_url: 'https://lila.constroad.com/files/a-t.jpg', mime: 'image/jpeg', name: 'a.jpg', label: 'Llegada' };
  it('keeps photos and videos from Constroad hosts, with their thumbnails', () => {
    const video = { url: 'https://lila.constroad.com/files/b.mp4', mime: 'video/mp4', name: 'b.mp4' };
    expect(validateBotBlocks([{ type: 'gallery', items: [photo, video] }], 8)).toEqual({ ok: true, blocks: [{ type: 'gallery', items: [
      { url: photo.url, thumbUrl: photo.thumb_url, mime: 'image/jpeg', name: 'a.jpg', label: 'Llegada' },
      { url: video.url, mime: 'video/mp4', name: 'b.mp4' },
    ] }] });
  });
  it('drops files from other hosts, plain http and other kinds, and keeps 20 at most', () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ ...photo, url: `https://lila.constroad.com/files/${index}.jpg` }));
    const checked = validateBotBlocks([{ type: 'gallery', items: [{ ...photo, url: 'https://evil.example/a.jpg' }, { ...photo, url: 'http://lila.constroad.com/a.jpg' }, { ...photo, mime: 'application/pdf' }, ...many] }], 8);
    expect(checked.ok && checked.blocks[0]?.type === 'gallery' ? checked.blocks[0].items.length : -1).toBe(BLOCK_LIMITS.gallery);
  });
  it('drops a thumbnail from another host but keeps the file', () => {
    const checked = validateBotBlocks([{ type: 'gallery', items: [{ ...photo, thumb_url: 'https://evil.example/t.jpg' }] }], 8);
    expect(checked).toMatchObject({ ok: true, blocks: [{ type: 'gallery', items: [{ url: photo.url }] }] });
    expect(checked.ok && checked.blocks[0]?.type === 'gallery' ? checked.blocks[0].items[0]?.thumbUrl : 'x').toBeUndefined();
  });
  it('refuses a gallery with no valid file', () => {
    expect(validateBotBlocks([{ type: 'gallery', items: [{ url: 'https://evil.example/a.jpg', mime: 'image/jpeg' }] }], 8)).toMatchObject({ ok: false });
  });
  it('turns its items into files the viewer swipes through', () => {
    expect(galleryFiles({ type: 'gallery', items: [{ url: photo.url, thumbUrl: photo.thumb_url, mime: 'image/jpeg', name: 'a.jpg', label: 'Llegada' }] })).toEqual([{ url: photo.url, thumbUrl: photo.thumb_url, mime: 'image/jpeg', name: 'a.jpg', when: 'Llegada' }]);
  });
  it('shows four thumbnails and counts the rest', () => {
    expect(galleryStrip(6)).toEqual({ shown: 4, more: 2 });
    expect(galleryStrip(3)).toEqual({ shown: 3, more: 0 });
  });
});
