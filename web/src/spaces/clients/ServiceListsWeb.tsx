import type { MouseEvent } from 'react';
import { ChevronRight, Clock, FileText, Ruler, Truck } from 'lucide-react';
import { DISPATCH_THUMB_SLOTS, detailEmptyText, detailRows, dispatchThumbs, orderCardsOf, orphanDispatchesOf, ordersTotalOf, reportGroups, type DetailRow, type DetailTabKey, type OrderCard, type OrderProgress, type OrderSummary, type ServiceDetail, type SheetMedia } from '@lilachat/shared';
import type { OpenSheetFile } from './RecordSheetWeb';
import { FileThumb } from './PortalFileViewer';
import { useCompactShell } from './ServiceShellWeb';
import { DETAIL_TONE } from './tones';

const KICKER = 'font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant';
/** 12 px radius (design cc-01/cc-02 pixel diff 20/11); the order's card border is 1.5 px on a phone. */
const CARD = 'overflow-hidden rounded-card border-[1.5px] border-outline/15 bg-surface';
/** Design cc-02 on a computer: the order's card floats on a shadow, no border. */
const ORDER_CARD = `${CARD} md:border-0 md:shadow-sm`;
const Chip = ({ row, large }: { row: DetailRow; large?: boolean }) => <span className={`shrink-0 rounded-md border font-bold ${large ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'} uppercase tracking-wide ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</span>;

/** José 30/10: the row opens its sheet inside Lilachat; the file opens in Lilachat's viewer, not in Portal. */
function RowView({ row, icon, onOpen, onOpenFile }: { row: DetailRow; icon?: boolean; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  return (
    <li data-testid={`fila-${row.id}`} className="flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
      {icon ? <span aria-hidden className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText size={18} /></span> : null}
      <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 flex-1 text-left">
        <p className="line-clamp-2 text-sm font-semibold hover:underline">{row.title}</p>
        {row.line ? <p className="truncate text-[12px] text-on-surface-variant">{row.line}</p> : null}
      </button>
      {/* On a phone the state and the file go under the title, so the title is not cut. */}
      {/* Without a file the state fits beside the title (design cc-03 mobile: a 64 px row). */}
      <span className={`flex shrink-0 items-center gap-3 ${row.file ? `max-sm:basis-full max-sm:justify-end ${icon ? 'max-sm:pl-[50px]' : ''}` : ''}`}>
        <Chip row={row} large={icon} />
        {row.file ? (
          <button type="button" onClick={() => row.file && onOpenFile({ url: row.file.url, name: `${row.title} · ${row.file.label}` })} data-testid={`archivo-${row.id}`} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-outline/20 px-2.5 text-[12px] font-semibold text-on-surface hover:bg-background"><FileText size={14} /> {row.file.label}</button>
        ) : null}
      </span>
    </li>
  );
}

/** The reports under a header per day, like Portal's list (José 31/10), as cards (design cc-03). */
function ReportDays({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  return (
    <div className="flex flex-col gap-4">
      {reportGroups(detail).map((group) => (
        <section key={group.title} data-testid={`dia-informes-${group.title}`}>
          <p className={`mb-2 flex justify-between px-1 ${KICKER}`}>{group.title}<span className="normal-case tracking-normal">{group.rows.length === 1 ? '1 informe' : `${group.rows.length} informes`}</span></p>
          <ul className="divide-y divide-outline/10 overflow-hidden rounded-card border border-outline/15 bg-surface">{group.rows.map((row) => <RowView key={row.id} row={row} icon onOpen={onOpen} onOpenFile={onOpenFile} />)}</ul>
        </section>
      ))}
    </div>
  );
}

const THUMB_PX = 40;

/**
 * A dispatch's thumbs (José 20/11): what fits the row, a «+K» tile for the rest, and any of them
 * opens the viewer with ALL its photos and videos. A video shows its frame with a play mark.
 */
function DispatchThumbs({ dispatch, onOpenFile }: { dispatch: OrderCard['dispatches'][number]; onOpenFile: OpenSheetFile }) {
  const compact = useCompactShell();
  const { media } = dispatch;
  const { shown, more } = dispatchThumbs(media, compact ? DISPATCH_THUMB_SLOTS.compact : DISPATCH_THUMB_SLOTS.wide);
  const firstHidden = media[shown.length];
  // The row opens the dispatch's sheet: a thumb opens the viewer instead.
  const open = (event: MouseEvent, file: SheetMedia) => { event.stopPropagation(); onOpenFile(file, media); };
  return (
    <span className="flex shrink-0 gap-1.5">
      {shown.map((one, index) => (
        <button key={one.url} type="button" data-testid={`despacho-foto-${index}`} aria-label={`Ver ${one.name}`} onClick={(event) => open(event, one)} className="overflow-hidden rounded-lg">
          <FileThumb file={one} size={THUMB_PX} />
        </button>
      ))}
      {more && firstHidden ? (
        <button type="button" data-testid={`despacho-mas-${dispatch.id}`} aria-label={`Ver ${more} más`} onClick={(event) => open(event, firstHidden)} className="grid shrink-0 place-items-center rounded-lg bg-primary/10 text-[13px] font-bold text-primary" style={{ width: THUMB_PX, height: THUMB_PX }}>
          {`+${more}`}
        </button>
      ) : null}
    </span>
  );
}

/** Hora · Unidad · Volumen · Fotos y videos on a wide window (ped-v2-escritorio-lista); a phone stacks hour and m³. */
const ROW_GRID = 'grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[72px_150px_96px_minmax(0,1fr)]';

function DispatchHeader() {
  return (
    <li aria-hidden className={`${ROW_GRID} bg-surface-variant/40 px-4 py-2 max-sm:hidden ${KICKER}`}>
      <span>Hora</span><span>Unidad</span><span>Volumen</span><span>Fotos y videos</span>
    </li>
  );
}

/**
 * A dispatch as a thin row (José 20/11, ped-v2): hour and m³, plate, its thumbs. Tapping the row
 * opens its sheet, which has every photo and video in a grid («no veo los archivos al tocar un despacho»).
 */
function DispatchRow({ dispatch, onOpen, onOpenFile }: { dispatch: OrderCard['dispatches'][number]; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  return (
    <li data-testid={`despacho-${dispatch.id}`} onClick={() => onOpen(dispatch.id)} className={`${ROW_GRID} min-h-[56px] cursor-pointer px-4 py-2 hover:bg-background/60 sm:min-h-[44px] sm:py-1.5`}>
      <span className="flex flex-col sm:contents">
        <span className="font-mono text-[13px] font-bold text-on-surface">{dispatch.hour ?? '—'}</span>
        <span className="text-[12px] text-on-surface-variant sm:hidden">{dispatch.quantity}</span>
      </span>
      {/* The button is for the keyboard: its click bubbles to the row, which opens the sheet once. */}
      <button type="button" aria-label={`Abrir despacho ${dispatch.title}`} className="flex min-w-0 items-center gap-2 text-left">
        <Truck size={17} className="shrink-0 text-on-surface-variant sm:hidden" />
        <span className="truncate font-mono text-[13px] font-bold text-on-surface sm:rounded-md sm:bg-surface-variant/60 sm:px-2 sm:py-0.5">{dispatch.title}</span>
      </button>
      <span className="text-[13px] font-semibold text-on-surface max-sm:hidden">{dispatch.quantity ?? '—'}</span>
      {dispatch.media.length ? <DispatchThumbs dispatch={dispatch} onOpenFile={onOpenFile} /> : <span className="text-[12px] italic text-on-surface-variant max-sm:hidden">Sin fotos</span>}
    </li>
  );
}

/** «5 despachos · 60 / 75 m³ · 18 medios» and the bar of the m³ sent (ped-v2). */
function OrderSummaryView({ id, summary, progress }: { id: string; summary: OrderSummary; progress?: OrderProgress }) {
  const percent = progress?.percent;
  return (
    <div data-testid={`resumen-${id}`} className="mt-3 border-t border-outline/10 pt-3">
      <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] font-semibold text-on-surface">
        <span>{summary.dispatches}</span>
        {summary.sent ? <span className="font-mono">{summary.sent}</span> : null}
        {summary.media ? <span className="text-primary">{summary.media}</span> : null}
      </p>
      {percent !== undefined ? (
        <span role="progressbar" aria-label="Avance del pedido" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-variant">
          <span className="block h-full rounded-full bg-en-linea" style={{ width: `${percent}%` }} />
        </span>
      ) : null}
    </div>
  );
}

/** One order as a card (José 01/11; ped-v2 20/11): its head opens its sheet, its dispatches go by hour. */
function OrderCardView({ card, onOpen, onOpenDispatch, onOpenFile }: { card: OrderCard; onOpen: (id: string) => void; onOpenDispatch: (id: string) => void; onOpenFile: OpenSheetFile }) {
  const { order, heading } = card;
  return (
    <article data-testid={`fila-${order.id}`} className={ORDER_CARD}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => onOpen(order.id)} className="min-w-0 flex-1 text-left">
            <p className="text-[15px] font-bold text-on-surface"><span className="hover:underline">{heading.title}</span>{heading.detail ? <span className="font-semibold text-on-surface-variant">{` · ${heading.detail}`}</span> : null}</p>
            {card.site ? <p className="truncate text-[13px] text-on-surface-variant">{card.site}</p> : null}
          </button>
          <Chip row={order} />
        </div>
        {card.summary ? <OrderSummaryView id={order.id} summary={card.summary} progress={card.progress} /> : <p className="mt-3 flex items-center gap-2 rounded-xl bg-background/60 px-3 py-3 text-[13px] text-on-surface-variant"><Clock size={15} /> Sin despachos todavía</p>}
      </div>
      {card.dispatches.length ? (
        <>
          <p className={`flex justify-between border-t border-outline/10 px-4 pt-3 sm:hidden ${KICKER}`}>{`Despachos · ${card.dispatches.length}`}<span className="normal-case tracking-normal">Por hora</span></p>
          <ul className="divide-y divide-outline/10 sm:border-t sm:border-outline/10">
            <DispatchHeader />
            {card.dispatches.map((one) => <DispatchRow key={one.id} dispatch={one} onOpen={onOpenDispatch} onOpenFile={onOpenFile} />)}
          </ul>
        </>
      ) : null}
      <div className="flex items-center gap-4 border-t border-outline/10 px-4">
        {card.dispatches.some((one) => one.cubicage) ? <button type="button" onClick={() => onOpen(order.id)} className="inline-flex h-9 items-center gap-1.5 text-[13px] font-semibold text-primary"><Ruler size={15} /> Cubicaje</button> : null}
        <button type="button" data-testid={`ver-pedido-${order.id}`} onClick={() => onOpen(order.id)} className="ml-auto inline-flex h-9 items-center gap-0.5 text-[13px] font-semibold text-primary">Ver pedido <ChevronRight size={15} /></button>
      </div>
    </article>
  );
}

/** Design cc-02 on a phone: «Pedidos asociados al servicio (N)» and what was ordered, per unit. */
function OrdersTotalView({ detail }: { detail: ServiceDetail }) {
  const totals = ordersTotalOf(detail.orders);
  if (!totals) return null;
  return (
    <div data-testid="pedidos-total" className="flex flex-wrap items-baseline justify-between gap-x-3 md:hidden">
      <p className={KICKER}>{`Pedidos asociados al servicio (${totals.count})`}</p>
      {totals.total ? <p className="text-[12px] text-on-surface-variant">Total: <span className="font-semibold text-on-surface">{totals.total}</span></p> : null}
    </div>
  );
}

/** Dispatches whose order did not come in the 100 Portal sent (José 01/11: they live inside their order). */
function OrphanDispatches({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  const rows = orphanDispatchesOf(detail);
  if (!rows.length) return null;
  return (
    <section data-testid="despachos-sin-pedido" className={CARD}>
      <p className={`bg-surface-variant/40 px-4 py-1.5 ${KICKER}`}>Despachos de otros pedidos</p>
      <ul className="divide-y divide-outline/10">{rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}</ul>
    </section>
  );
}

/** The open list: orders as cards with their dispatches, reports by day. */
export function ServiceListWeb({ detail, tab, onOpen, onOpenDispatch, onOpenFile }: { detail: ServiceDetail; tab: DetailTabKey; onOpen: (id: string) => void; onOpenDispatch: (id: string) => void; onOpenFile: OpenSheetFile }) {
  if (!detailRows(detail, tab).length) return <p className={`${CARD} p-4 text-sm text-on-surface-variant`}>{detailEmptyText(tab, detail.totals)}</p>;
  if (tab === 'reports') return <ReportDays detail={detail} onOpen={onOpen} onOpenFile={onOpenFile} />;
  return (
    <>
      <OrdersTotalView detail={detail} />
      {orderCardsOf(detail).map((card) => <OrderCardView key={card.order.id} card={card} onOpen={onOpen} onOpenDispatch={onOpenDispatch} onOpenFile={onOpenFile} />)}
      <OrphanDispatches detail={detail} onOpen={onOpenDispatch} onOpenFile={onOpenFile} />
    </>
  );
}
