import { describe, expect, it } from 'vitest';
import { DISPATCH_THUMB_SLOTS, dispatchThumbSlotsFor, dispatchThumbs, orderCardsOf, orderProgressOf, ordersTotalOf } from './serviceOrderCards.js';
import type { ServiceDetail } from './serviceDetail.js';

const ok = { label: 'Despachado', tone: 'ok' as const };
const picture = (name: string) => ({ url: `https://x/${name}.jpg`, mime: 'image/jpeg', name });
const detail = {
  service: { id: 's1', name: 'Parches' },
  orders: [
    { id: 'o1', product: 'Mezcla asfáltica en caliente', quantity: 12, unit: 'm³', date: '2026-11-18', site: 'JR CONCHUCOS', status: ok },
    { id: 'o2', product: 'Emulsión asfáltica', quantity: 300, unit: 'gal', date: '2026-11-20', status: { label: 'Pendiente', tone: 'warn' as const } },
  ],
  dispatches: [
    { id: 'd1', orderId: 'o1', plate: 'ABC-123', quantity: 6, unit: 'm³', at: '2026-11-18T13:20:00Z', status: ok, pictures: [picture('a'), picture('b'), picture('c'), picture('d')] },
    { id: 'd2', orderId: 'o1', plate: 'BCD-456', quantity: 6, unit: 'm³', status: ok, cubicage: { m3: 6, dimensions: [] } },
    { id: 'd3', orderId: 'otro', plate: 'ZZZ-999', status: ok },
  ],
  reports: [],
  totals: { orders: 2, dispatches: 3, reports: 0 },
} satisfies ServiceDetail;

describe('orderCardsOf (design cc-02: each order with its dispatches inside)', () => {
  it('heads each order with its product, quantity, day and site', () => {
    const [first] = orderCardsOf(detail);
    expect(first?.order.title).toBe('Mezcla asfáltica en caliente');
    expect(first?.order.line).toBe('12 m³ · 18 nov · 2 despachos · JR CONCHUCOS');
  });
  it('lists its own dispatches with plate, quantity and hour, and ALL their pictures for the viewer', () => {
    const [first] = orderCardsOf(detail);
    expect(first?.dispatches.map((one) => one.title)).toEqual(['ABC-123', 'BCD-456']);
    expect(first?.dispatches[0]?.line).toBe('6 m³ · 08:20');
    expect(first?.dispatches[0]?.media.map((one) => one.name)).toEqual(['a', 'b', 'c', 'd']);
    expect(first?.dispatches[0]?.media[0]?.when).toBe('2026-11-18T13:20:00Z');
    expect(first?.dispatches[1]?.media).toEqual([]);
    expect(first?.dispatches[1]?.line).toBe('6 m³');
    expect(first?.dispatches[1]?.cubicage).toBe(true);
  });
  it('an order without dispatches has an empty list, not another order\'s', () => {
    expect(orderCardsOf(detail)[1]?.dispatches).toEqual([]);
  });
});

describe('dispatchThumbs (José 20/11: more than 3 pictures, and a «+K» tile)', () => {
  const media = (count: number) => Array.from({ length: count }, (_, index) => ({ url: `https://x/${index}.jpg`, mime: 'image/jpeg', name: `${index}` }));
  it('shows every picture when they fit the slots', () => {
    expect(dispatchThumbs(media(3), 3)).toEqual({ shown: media(3), more: 0 });
  });
  it('gives the last slot to «+K» when there are more than the slots', () => {
    const thumbs = dispatchThumbs(media(7), 3);
    expect(thumbs.shown.map((one) => one.name)).toEqual(['0', '1']);
    expect(thumbs.more).toBe(5);
  });
  it('a dispatch without pictures shows nothing', () => {
    expect(dispatchThumbs([], DISPATCH_THUMB_SLOTS.wide)).toEqual({ shown: [], more: 0 });
  });
  it('a phone row fits fewer thumbs than a wide one; a lone slot is the «+K» tile', () => {
    expect(DISPATCH_THUMB_SLOTS.compact).toBeLessThan(DISPATCH_THUMB_SLOTS.wide);
    expect(dispatchThumbs(media(4), 0)).toEqual({ shown: [], more: 4 });
  });
});

describe('dispatchThumbSlotsFor (the APK reads its window width)', () => {
  it('a phone gets the compact slots and a tablet the wide ones', () => {
    expect(dispatchThumbSlotsFor(390)).toBe(DISPATCH_THUMB_SLOTS.compact);
    expect(dispatchThumbSlotsFor(767)).toBe(DISPATCH_THUMB_SLOTS.compact);
    expect(dispatchThumbSlotsFor(768)).toBe(DISPATCH_THUMB_SLOTS.wide);
  });
});

describe('the order card as ped-v2 draws it (José 20/11: «¿te parece ordenado?»)', () => {
  const at = (hour: string) => `2026-11-20T${hour}:00Z`;
  const timed = {
    ...detail,
    dispatches: [
      { id: 'late', orderId: 'o1', plate: 'LATE-1', quantity: 4, unit: 'm³', at: at('15:10'), status: ok },
      { id: 'none', orderId: 'o1', plate: 'NONE-1', status: ok },
      { id: 'early', orderId: 'o1', plate: 'EARLY-1', quantity: 5.5, unit: 'm³', at: at('12:05'), status: ok, pictures: [picture('x'), picture('y')] },
    ],
  } satisfies ServiceDetail;

  it('orders the dispatches by hour, those without one last, with the hour and m³ apart', () => {
    // Act
    const [first] = orderCardsOf(timed);
    // Assert
    expect(first?.dispatches.map((one) => one.id)).toEqual(['early', 'late', 'none']);
    expect(first?.dispatches[0]).toMatchObject({ hour: '07:05', quantity: '5.5 m³', title: 'EARLY-1' });
    expect(first?.dispatches[2]?.hour).toBeUndefined();
  });

  it('heads the card with the product and «qty · day», the site apart, and no invented code', () => {
    // Act
    const [first, second] = orderCardsOf(timed);
    // Assert
    expect(first?.heading).toEqual({ title: 'Mezcla asfáltica en caliente', detail: '12 m³ · 18 nov' });
    expect(first?.site).toBe('JR CONCHUCOS');
    expect(second?.site).toBeUndefined();
  });

  it('without a product the head reads «Pedido · day»', () => {
    // Act
    const [first] = orderCardsOf({ ...timed, orders: [{ id: 'o1', date: '2026-11-20', status: ok }] });
    // Assert
    expect(first?.heading).toEqual({ title: 'Pedido', detail: '20 nov' });
  });

  it('sums «N despachos · X / Y m³ · N medios» with the progress of its m³', () => {
    // Act
    const [first, second] = orderCardsOf(timed);
    // Assert
    expect(first?.summary).toEqual({ dispatches: '3 despachos', sent: '9.5 / 12 m³', media: '2 medios' });
    expect(first?.progress).toEqual({ delivered: 9.5, ordered: 12, percent: 79 });
    expect(second?.summary).toBeUndefined();
    expect(second?.progress).toBeUndefined();
  });
});

describe('orderProgressOf (dispatched m³ against the order\'s)', () => {
  const order = { id: 'o', quantity: 10, unit: 'm³', status: ok };
  const sent = (quantity?: number, unit?: string) => ({ id: `${quantity}`, status: ok, quantity, unit });

  it('counts only the dispatches in the order\'s unit (or without one)', () => {
    expect(orderProgressOf(order, [sent(4, 'm³'), sent(3), sent(100, 'gal')])).toEqual({ delivered: 7, ordered: 10, percent: 70 });
  });
  it('caps the bar at 100 % when more was sent than ordered', () => {
    expect(orderProgressOf(order, [sent(12, 'm³')])?.percent).toBe(100);
  });
  it('an order without a quantity has what was sent and no percent', () => {
    expect(orderProgressOf({ ...order, quantity: undefined }, [sent(4, 'm³')])).toEqual({ delivered: 4 });
  });
  it('nothing to sum (no dispatch carries a quantity) is no progress at all', () => {
    expect(orderProgressOf(order, [sent()])).toBeUndefined();
    expect(orderProgressOf(order, [])).toBeUndefined();
  });
  it('a float sum from Portal reads with two decimals at most', () => {
    expect(orderProgressOf(order, [sent(0.1, 'm³'), sent(0.2, 'm³')])?.delivered).toBe(0.3);
  });
});

describe('ordersTotalOf (design cc-02 mobile: «Pedidos asociados · Total»)', () => {
  it('sums the ordered quantity per unit, in the order they first appear', () => {
    const total = ordersTotalOf([{ quantity: 8, unit: 'm³' }, { quantity: 300, unit: 'gal' }, { quantity: 4, unit: 'M³ ' }]);
    expect(total).toEqual({ count: 3, total: '12 m³ + 300 gal' });
  });

  it('leaves the total out when no order has a quantity', () => {
    expect(ordersTotalOf([{ unit: 'm³' }, {}])).toEqual({ count: 2 });
  });

  it('counts a quantity without a unit apart from the ones with a unit', () => {
    expect(ordersTotalOf([{ quantity: 2 }, { quantity: 5, unit: 'm³' }])).toEqual({ count: 2, total: '2 + 5 m³' });
  });

  it('gives nothing for a service without orders', () => {
    expect(ordersTotalOf([])).toBeUndefined();
  });
});
