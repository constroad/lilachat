import { useMemo, useState, type ReactNode } from 'react';
import { PERIOD_LABEL, moneyOf, panelOf, periodStartOf, type BoardPeriod } from '@lilachat/shared';
import { EmptyNote, Kicker, Segmented, SkeletonRows } from './daliParts';
import type { ProspectList } from './prospectsApi';

type Panel = ReturnType<typeof panelOf>;
const PERIODS: BoardPeriod[] = ['today', 'week', 'month'];
const percent = (part: number, whole: number): string => (whole ? `${Math.round((part / whole) * 100)} %` : '—');
const MINUTE_S = 60;
const HOUR_MIN = 60;
/** «40 s», «25 min», «3 h»: a response time said the way a person says it. */
const secondsText = (seconds: number): string => (seconds < MINUTE_S ? `${seconds} s` : minutesText(Math.round(seconds / MINUTE_S)));
const minutesText = (minutes: number): string => (minutes < 2 * HOUR_MIN ? `${minutes} min` : `${Math.round(minutes / HOUR_MIN)} h`);
/** A phone keeps the columns that fit in 390 px (dl-04 v5: prospects and conversion); the rest is for a computer. */
const PHONE_COLUMNS = { origin: [0, 1, 4, 5], ad: [0, 1, 3], sellers: [0, 1, 3, 5] } as const;
const columnsOf = <T,>(cells: readonly T[], keep: readonly number[] | null): T[] => (keep ? keep.map((index) => cells[index]!) : [...cells]);
const amountOf = (amounts: { currency: string; amount: number }[]): string => amounts.map((one) => (one.currency === 'PEN' ? moneyOf(one.amount) : `${one.currency} ${one.amount.toFixed(2)}`)).join(' + ');

/**
 * The sales panel (dl-04 v3, v5 on a phone): the prospects BORN in the period, followed to wherever they got. What has
 * no source yet does not go: Meta's costs (no `ads_read`), automatic assignment, «Exportar» and the lines Stitch wrote
 * under each figure. The amount won is an admin's: nobody else receives amounts.
 */
export function DaliPanel({ list, now, phone }: { list: ProspectList | null; now: Date; phone?: boolean }) {
  const [period, setPeriod] = useState<BoardPeriod>('week');
  const panel = useMemo(() => panelOf(list?.prospects ?? [], { from: periodStartOf(period, now) }), [list, period, now]);
  if (!list) return <div className="p-4"><SkeletonRows /></div>;
  return (
    <div data-testid="panel-dali" className="space-y-4 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Panel de ventas</h2>
        <span className="min-w-0 flex-1" />
        <div className="w-full sm:w-72"><Segmented testId="periodo-panel" value={period} onChange={setPeriod} segments={PERIODS.map((key) => ({ key, label: PERIOD_LABEL[key] }))} /></div>
      </div>
      {panel.totals.prospects === 0 ? <EmptyNote title="No llegó ningún prospecto en este periodo." /> : <PanelBody panel={panel} admin={list.admin} phone={phone} />}
    </div>
  );
}

function PanelBody({ panel, admin, phone }: { panel: Panel; admin: boolean; phone?: boolean }) {
  const { totals, firstResponse } = panel;
  const keep = (key: keyof typeof PHONE_COLUMNS) => (phone ? PHONE_COLUMNS[key] : null);
  return (
    <>
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-outline/15 bg-surface sm:grid-cols-3 xl:grid-cols-6">
        <Figure testId="panel-prospectos" value={String(totals.prospects)} label="Prospectos" />
        <Figure value={String(totals.qualified)} label="Calificados" note={percent(totals.qualified, totals.prospects)} />
        <Figure value={String(totals.quoted)} label="Cotizados" note={percent(totals.quoted, totals.prospects)} />
        <Figure testId="panel-ganados" value={String(totals.won)} label="Ganados" note={percent(totals.won, totals.prospects)} />
        {admin ? <Figure testId="panel-monto" value={totals.amountWon.length ? amountOf(totals.amountWon) : moneyOf(0)} label="Monto ganado" small /> : null}
        <Figure value={firstResponse.sellerMinutes === null ? '—' : minutesText(firstResponse.sellerMinutes)} label="Primera respuesta del equipo" note={firstResponse.daliSeconds === null ? undefined : `Dali: ${secondsText(firstResponse.daliSeconds)}`} />
      </div>
      <div className={`grid gap-4 ${phone ? '' : 'lg:grid-cols-2'}`}>
        <Block title="Por origen">
          <Table head={columnsOf(['Origen', 'Prosp.', 'Calif.', 'Cotiz.', 'Ganados', 'Conv.'], keep('origin'))} rows={panel.byOrigin.map((row) => columnsOf([row.label, row.prospects, row.qualified, row.quoted, row.won, percent(row.won, row.prospects)], keep('origin')))} />
        </Block>
        <Block title="Embudo">
          <Bars rows={[{ label: 'Prospectos', value: totals.prospects }, { label: 'Calificados', value: totals.qualified }, { label: 'Cotizados', value: totals.quoted }, { label: 'Ganados', value: totals.won }]} max={totals.prospects} />
        </Block>
        {panel.byAd.length ? (
          <Block title="Por anuncio">
            <Table head={columnsOf(['Anuncio', 'Prosp.', 'Calif.', 'Ganados', 'Solo consulta'], keep('ad'))} rows={panel.byAd.map((row) => columnsOf([row.title, row.prospects, row.qualified, row.won, row.onlyAsked], keep('ad')))} />
          </Block>
        ) : null}
        <Block title="Intención">
          <Bars rows={panel.intents.map((row) => ({ label: row.label, value: row.count }))} max={Math.max(...panel.intents.map((row) => row.count), 1)} />
        </Block>
        {panel.sellers.length ? (
          <Block title="Vendedores">
            <Table head={columnsOf(['Vendedor', 'Asignados', 'Respondió', 'A tiempo', 'Cotizó', 'Ganó'], keep('sellers'))} rows={panel.sellers.map((row) => columnsOf([row.name, row.assigned, row.answered, row.onTime, row.quoted, row.won], keep('sellers')))} />
          </Block>
        ) : null}
        {panel.lossReasons.length ? (
          <Block title="Por qué se pierden">
            <Bars rows={panel.lossReasons.map((row) => ({ label: row.label, value: row.count }))} max={Math.max(...panel.lossReasons.map((row) => row.count), 1)} tone="error" />
          </Block>
        ) : null}
      </div>
    </>
  );
}

function Figure({ value, label, note, small, testId }: { value: string; label: string; note?: string; small?: boolean; testId?: string }) {
  return (
    <div data-testid={testId} className="border-b border-r border-outline/10 px-4 py-3">
      <p className={`font-extrabold tabular-nums tracking-tight ${small ? 'text-lg' : 'text-3xl'}`}>{value}</p>
      <p className="text-[13px] font-semibold">{label}</p>
      {note ? <p className="text-[12px] text-on-surface-variant">{note}</p> : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <Kicker>{title}</Kicker>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant">{head.map((cell, index) => <th key={cell} className={`py-1.5 font-semibold ${index ? 'text-right' : ''}`}>{cell}</th>)}</tr></thead>
        <tbody className="divide-y divide-outline/10">
          {rows.map((row) => (
            <tr key={String(row[0])}>{row.map((cell, index) => <td key={index} className={`py-1.5 ${index ? 'text-right tabular-nums' : 'max-w-[180px] truncate font-semibold'}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bars({ rows, max, tone = 'primary' }: { rows: { label: string; value: number }[]; max: number; tone?: 'primary' | 'error' }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="text-[13px]">
          <span className="flex justify-between"><span>{row.label}</span><span className="font-semibold tabular-nums">{row.value}</span></span>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface-variant/60"><span className={`block h-full rounded-full ${tone === 'error' ? 'bg-error/70' : 'bg-primary'}`} style={{ width: `${max ? (row.value / max) * 100 : 0}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}
