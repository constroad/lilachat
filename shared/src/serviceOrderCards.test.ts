import { describe, expect, it } from 'vitest';
import { DISPATCH_THUMB_SLOTS, dispatchThumbSlotsFor, dispatchThumbs, orderCardsOf } from './serviceOrderCards.js';
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
