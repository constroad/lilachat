import { limaDayKey } from './birthdays.js';

/**
 * Seasonal winks (pending 73, José 22/10): Halloween in October, Christmas in
 * December, and so on; out of their season they are not offered (one already
 * received still plays). Dates are Lima's. PURE.
 */
export type WinkSeason = 'halloween' | 'christmas' | 'newyear' | 'valentine' | 'mothers' | 'patrias';

type MonthDay = readonly [month: number, day: number];

export const WINK_SEASONS: readonly { season: WinkSeason; title: string; from: MonthDay; to: MonthDay }[] = [
  { season: 'halloween', title: 'Halloween', from: [10, 1], to: [11, 2] },
  { season: 'christmas', title: 'Navidad', from: [12, 1], to: [12, 26] },
  { season: 'newyear', title: 'Año Nuevo', from: [12, 27], to: [1, 7] },
  { season: 'valentine', title: 'San Valentín', from: [2, 1], to: [2, 15] },
  { season: 'mothers', title: 'Día de la Madre', from: [5, 1], to: [5, 15] },
  { season: 'patrias', title: 'Fiestas Patrias', from: [7, 15], to: [7, 31] },
];

const order = ([month, day]: MonthDay): number => month * 100 + day;

/** The season of a moment in Lima, or null between seasons. A season can cross the new year. */
export function seasonOf(now: Date): { season: WinkSeason; title: string } | null {
  const [, month, day] = limaDayKey(now).split('-').map(Number);
  const today = order([month!, day!]);
  for (const entry of WINK_SEASONS) {
    const from = order(entry.from);
    const to = order(entry.to);
    const inside = from <= to ? today >= from && today <= to : today >= from || today <= to;
    if (inside) return { season: entry.season, title: entry.title };
  }
  return null;
}
