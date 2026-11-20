/**
 * The figures of a service's card (José 19/11, design cc-01): how many orders and reports it
 * has, how many stages, and its last movement. Portal sends them through agentes in
 * `PUT /api/bots/clients/:clientId`; all four are OPTIONAL and only a valid one passes (a
 * whole number ≥ 0, a real date, a short text). What did not come is left out: the card hides
 * it or shows «—», it never makes a figure up. PURE.
 */
import { limaDayKey } from './birthdays.js';
import { dayOf } from './serviceDetail.js';

/** The last movement's text is one short line. */
export const SERVICE_ACTIVITY_TEXT_MAX = 80;
const DAY_MS = 86_400_000;
/** Peru has no daylight saving: Lima is always UTC−5. */
const LIMA_OFFSET_MS = 5 * 3_600_000;
/** «HH:MM» inside an ISO string. */
const HOUR_START = 11;
const HOUR_END = 16;

export type ServiceLastActivity = { /** ISO instant. */ at: string; text: string };
/** What a service may carry besides its state: both in the stored state and in `SpaceClientService`. */
export type ServiceFacts = { ordersCount?: number; reportsCount?: number; stagesTotal?: number; lastActivity?: ServiceLastActivity };

const wholeCount = (raw: unknown): number | undefined => (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : undefined);

function lastActivityOf(raw: unknown): ServiceLastActivity | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { at, text } = raw as Record<string, unknown>;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at)) || typeof text !== 'string') return undefined;
  const line = text.replace(/\s+/g, ' ').trim().slice(0, SERVICE_ACTIVITY_TEXT_MAX);
  return line ? { at: new Date(at).toISOString(), text: line } : undefined;
}

/**
 * The facts of one service of the PUT body; a white list. agentes sends these four keys in
 * camelCase though the rest of the body is snake_case (contract of 19/11). `stagesTotal` is the
 * stages of the work MAP, not the derived ones of `serviceStages.ts`; `reportsCount` only the
 * public reports without money. A service without data sends 0/0/0 and no `lastActivity`.
 */
export function serviceFactsFromWire(raw: unknown): ServiceFacts {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const ordersCount = wholeCount(body.ordersCount);
  const reportsCount = wholeCount(body.reportsCount);
  const stagesTotal = wholeCount(body.stagesTotal);
  const lastActivity = lastActivityOf(body.lastActivity);
  return {
    ...(ordersCount !== undefined ? { ordersCount } : {}),
    ...(reportsCount !== undefined ? { reportsCount } : {}),
    ...(stagesTotal !== undefined ? { stagesTotal } : {}),
    ...(lastActivity ? { lastActivity } : {}),
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** «Hoy 09:40», «Ayer 17:05» or «2 nov», by the calendar and the clock of Lima. */
export function activityWhen(iso: string, now: Date): string {
  const at = new Date(iso);
  const day = limaDayKey(at);
  const hour = new Date(at.getTime() - LIMA_OFFSET_MS).toISOString().slice(HOUR_START, HOUR_END);
  if (day === limaDayKey(now)) return `Hoy ${hour}`;
  if (day === limaDayKey(new Date(now.getTime() - DAY_MS))) return `Ayer ${hour}`;
  return dayOf(day);
}

export type ServiceCardFacts = {
  ordersCount?: number;
  reportsCount?: number;
  ordersLabel?: string;
  reportsLabel?: string;
  /** «Inicio 12 nov · 6 etapas», with what exists only. */
  startLine: string;
  lastActivity?: { when: string; text: string };
};

/** What a service card shows of its facts (design cc-01, row on a computer, card on a phone). */
export function serviceCardFacts(service: ServiceFacts & { started_at?: string }, now: Date): ServiceCardFacts {
  const { ordersCount, reportsCount, stagesTotal, lastActivity } = service;
  const startLine = [service.started_at ? `Inicio ${dayOf(service.started_at)}` : null, stagesTotal ? plural(stagesTotal, 'etapa', 'etapas') : null].filter(Boolean).join(' · ');
  return {
    ...(ordersCount !== undefined ? { ordersCount, ordersLabel: plural(ordersCount, 'pedido', 'pedidos') } : {}),
    ...(reportsCount !== undefined ? { reportsCount, reportsLabel: plural(reportsCount, 'informe', 'informes') } : {}),
    startLine,
    ...(lastActivity ? { lastActivity: { when: activityWhen(lastActivity.at, now), text: lastActivity.text } } : {}),
  };
}
