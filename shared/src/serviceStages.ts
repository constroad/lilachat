import { moneyOf } from './serviceBilling.js';
import type { ServiceDetail } from './serviceDetail.js';

/**
 * Where a client's service stands, stage by stage, from what Portal already
 * records (José 30/10 asked whether to keep building the checklist by hand and
 * how to measure progress): quote, orders, dispatches, reports, invoices and collection. No
 * one ticks them: each one reads its own data. Quotes and money only come in
 * the private view, so those stages show only there. PURE.
 */
export type StageState = 'done' | 'doing' | 'pending';
export type ServiceStageKey = 'quote' | 'orders' | 'dispatches' | 'reports' | 'invoices' | 'collection';
export type ServiceStage = { key: ServiceStageKey; label: string; state: StageState; line: string };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function quoteStage(detail: ServiceDetail): ServiceStage | null {
  const quotes = detail.quotes;
  if (!quotes) return null;
  const approved = quotes.find((quote) => quote.status.tone === 'ok');
  if (approved) return { key: 'quote', label: 'Cotización', state: 'done', line: `${approved.code ? `Cotización ${approved.code}` : 'Cotización'} aprobada` };
  return quotes.length ? { key: 'quote', label: 'Cotización', state: 'doing', line: quotes[0]!.status.label } : { key: 'quote', label: 'Cotización', state: 'pending', line: 'Sin cotización' };
}

const ordersStage = (detail: ServiceDetail): ServiceStage =>
  detail.totals.orders > 0 ? { key: 'orders', label: 'Pedidos', state: 'done', line: plural(detail.totals.orders, 'pedido', 'pedidos') } : { key: 'orders', label: 'Pedidos', state: 'pending', line: 'Sin pedidos' };

function dispatchesStage(detail: ServiceDetail): ServiceStage {
  const count = detail.totals.dispatches;
  if (count === 0) return { key: 'dispatches', label: 'Despachos', state: 'pending', line: 'Sin despachos' };
  const waiting = detail.orders.filter((order) => order.status.tone !== 'ok').length;
  const line = plural(count, 'despacho', 'despachos');
  return waiting ? { key: 'dispatches', label: 'Despachos', state: 'doing', line: `${line} · ${plural(waiting, 'pedido', 'pedidos')} por despachar` } : { key: 'dispatches', label: 'Despachos', state: 'done', line };
}

function reportsStage(detail: ServiceDetail): ServiceStage {
  if (detail.reports.length === 0) return { key: 'reports', label: 'Informes', state: 'pending', line: 'Sin informes' };
  const published = detail.reports.filter((report) => report.status.tone === 'ok').length;
  if (published === detail.reports.length) return { key: 'reports', label: 'Informes', state: 'done', line: plural(published, 'informe publicado', 'informes publicados') };
  return { key: 'reports', label: 'Informes', state: 'doing', line: `${published} de ${detail.reports.length} publicados` };
}

function invoicesStage(detail: ServiceDetail): ServiceStage | null {
  const items = detail.billing?.items;
  if (!items) return null;
  const invoiced = items.filter((item) => item.invoiced).length;
  if (items.length === 0 || invoiced === 0) return { key: 'invoices', label: 'Facturación', state: 'pending', line: 'Sin facturar' };
  if (invoiced === items.length) return { key: 'invoices', label: 'Facturación', state: 'done', line: 'Todo facturado' };
  return { key: 'invoices', label: 'Facturación', state: 'doing', line: `${invoiced} de ${items.length} partidas facturadas` };
}

function collectionStage(detail: ServiceDetail): ServiceStage | null {
  const billing = detail.billing;
  if (!billing?.total) return null;
  if (billing.collected >= billing.total || billing.pending === 0) return { key: 'collection', label: 'Cobranza', state: 'done', line: `Cobrado ${moneyOf(billing.total)}` };
  if (billing.collected > 0) return { key: 'collection', label: 'Cobranza', state: 'doing', line: `Cobrado ${moneyOf(billing.collected)} de ${moneyOf(billing.total)}` };
  return { key: 'collection', label: 'Cobranza', state: 'pending', line: `Por cobrar ${moneyOf(billing.total)}` };
}

export function serviceStages(detail: ServiceDetail): ServiceStage[] {
  return [quoteStage(detail), ordersStage(detail), dispatchesStage(detail), reportsStage(detail), invoicesStage(detail), collectionStage(detail)].filter((stage): stage is ServiceStage => stage !== null);
}

export const stagesDone = (stages: readonly ServiceStage[]): { done: number; total: number } => ({ done: stages.filter((stage) => stage.state === 'done').length, total: stages.length });
