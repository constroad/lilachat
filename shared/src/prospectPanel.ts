import { compareNames } from './compareText.js';
import { INTENT_LABEL, originOf, shownStageOf, type ProspectView } from './prospectBoard.js';
import { PROSPECT_INTENTS, type ProspectStage } from './prospectInsight.js';
import { LOSS_REASON_LABEL, LOSS_REASONS } from './prospectSeller.js';

/**
 * Dali's sales panel (dl-04): the prospects BORN in the period, followed to wherever they got. A cohort, so the
 * funnel's percentages add up. What Stitch drew and has no source (cost per prospect without `ads_read`, automatic
 * assignment) is not computed. Money (`amountWon`) only adds up for an admin: nobody else receives amounts. PURE.
 */

const MINUTE_MS = 60_000;
/** A person answered on time: within 15 min of the prospect being ready (or of its first message). */
const ON_TIME_MS = 15 * MINUTE_MS;
const DEFAULT_CURRENCY = 'PEN';
const QUALIFIED: readonly ProspectStage[] = ['to_quote', 'visit', 'quoted', 'negotiation', 'won'];
const QUOTED: readonly ProspectStage[] = ['quoted', 'negotiation', 'won'];

const time = (iso: string | undefined): number => (iso ? Date.parse(iso) : Number.NaN);
const isQualified = (prospect: ProspectView): boolean => Boolean(prospect.readyAt) || QUALIFIED.includes(shownStageOf(prospect));
const isQuoted = (prospect: ProspectView): boolean => Boolean(prospect.quote) || QUOTED.includes(shownStageOf(prospect));
const isWon = (prospect: ProspectView): boolean => shownStageOf(prospect) === 'won';
const wonAmount = (prospect: ProspectView): number => (isWon(prospect) ? prospect.quote?.amount ?? 0 : 0);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** How long a person took since the prospect was ready (or wrote first), in ms; null when nobody answered. */
function sellerDelayOf(prospect: ProspectView): number | null {
  const start = time(prospect.readyAt ?? prospect.firstContactAt);
  const delay = time(prospect.firstTeamReply?.at) - start;
  return Number.isFinite(delay) && delay >= 0 ? delay : null;
}

function firstResponseOf(prospects: readonly ProspectView[]) {
  const dali = prospects.map((one) => time(one.firstDaliReplyAt) - time(one.firstContactAt)).filter((delay) => Number.isFinite(delay) && delay >= 0);
  const seller = prospects.map(sellerDelayOf).filter((delay): delay is number => delay !== null);
  const daliMs = median(dali);
  const sellerMs = median(seller);
  return { daliSeconds: daliMs === null ? null : Math.round(daliMs / 1000), sellerMinutes: sellerMs === null ? null : Math.round(sellerMs / MINUTE_MS) };
}

function amountsWon(prospects: readonly ProspectView[]): { currency: string; amount: number }[] {
  const sums = new Map<string, number>();
  for (const prospect of prospects.filter(isWon)) {
    if (prospect.quote?.amount === undefined) continue;
    const currency = prospect.quote.currency ?? DEFAULT_CURRENCY;
    sums.set(currency, (sums.get(currency) ?? 0) + prospect.quote.amount);
  }
  return [...sums].map(([currency, amount]) => ({ currency, amount }));
}

function byOriginOf(prospects: readonly ProspectView[]) {
  const rows = new Map<string, { key: string; label: string; prospects: number; qualified: number; quoted: number; won: number; amountWon: number }>();
  for (const prospect of prospects) {
    const origin = originOf(prospect);
    const row = rows.get(origin.key) ?? { ...origin, prospects: 0, qualified: 0, quoted: 0, won: 0, amountWon: 0 };
    rows.set(origin.key, { ...row, prospects: row.prospects + 1, qualified: row.qualified + Number(isQualified(prospect)), quoted: row.quoted + Number(isQuoted(prospect)), won: row.won + Number(isWon(prospect)), amountWon: row.amountWon + wonAmount(prospect) });
  }
  return [...rows.values()].sort((a, b) => b.prospects - a.prospects);
}

function byAdOf(prospects: readonly ProspectView[]) {
  const rows = new Map<string, { title: string; prospects: number; qualified: number; won: number; onlyAsked: number }>();
  for (const prospect of prospects) {
    const title = prospect.source?.adTitle;
    if (!title) continue;
    const row = rows.get(title) ?? { title, prospects: 0, qualified: 0, won: 0, onlyAsked: 0 };
    rows.set(title, { ...row, prospects: row.prospects + 1, qualified: row.qualified + Number(isQualified(prospect)), won: row.won + Number(isWon(prospect)), onlyAsked: row.onlyAsked + Number(prospect.intent === 'information') });
  }
  return [...rows.values()].sort((a, b) => b.prospects - a.prospects || b.won - a.won || compareNames(a.title, b.title));
}

type SellerRow = { id: string; name: string; assigned: number; answered: number; onTime: number; quoted: number; won: number };

/** Each seller: the prospects they hold, the ones they answered first (and how many within 15 min), quoted and won. */
function sellersOf(prospects: readonly ProspectView[]): SellerRow[] {
  const rows = new Map<string, SellerRow>();
  const rowOf = (id: string, name: string) => rows.get(id) ?? { id, name, assigned: 0, answered: 0, onTime: 0, quoted: 0, won: 0 };
  for (const prospect of prospects) {
    if (prospect.assignee) {
      const row = rowOf(prospect.assignee.id, prospect.assignee.name);
      rows.set(row.id, { ...row, assigned: row.assigned + 1, quoted: row.quoted + Number(isQuoted(prospect)), won: row.won + Number(isWon(prospect)) });
    }
    const reply = prospect.firstTeamReply;
    const known = reply ? rows.get(reply.userId) : undefined;
    if (!reply || !known) continue;
    const delay = sellerDelayOf(prospect);
    rows.set(known.id, { ...known, answered: known.answered + 1, onTime: known.onTime + Number(delay !== null && delay <= ON_TIME_MS) });
  }
  return [...rows.values()].sort((a, b) => b.assigned - a.assigned || compareNames(a.name, b.name));
}

function lossReasonsOf(prospects: readonly ProspectView[]) {
  const counted = LOSS_REASONS.map((key) => ({ key, label: LOSS_REASON_LABEL[key], count: prospects.filter((one) => one.result?.reason === key).length }));
  return counted.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
}

/** The panel of the prospects born since `from` (and before `to`, when given). */
export function panelOf(prospects: readonly ProspectView[], period: { from: string; to?: string }) {
  const from = time(period.from);
  const to = period.to ? time(period.to) : Infinity;
  const born = prospects.filter((one) => time(one.createdAt) >= from && time(one.createdAt) < to);
  return {
    totals: {
      prospects: born.length,
      qualified: born.filter(isQualified).length,
      quoted: born.filter(isQuoted).length,
      won: born.filter(isWon).length,
      lost: born.filter((one) => shownStageOf(one) === 'lost').length,
      amountWon: amountsWon(born),
    },
    firstResponse: firstResponseOf(born),
    byOrigin: byOriginOf(born),
    byAd: byAdOf(born),
    intents: PROSPECT_INTENTS.map((key) => ({ key, label: INTENT_LABEL[key], count: born.filter((one) => one.intent === key).length })),
    sellers: sellersOf(born),
    lossReasons: lossReasonsOf(born),
  };
}
