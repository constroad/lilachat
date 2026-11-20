import { Clock, FileText, Image as ImageIcon, Ruler, Truck } from 'lucide-react';
import { detailEmptyText, detailRows, orderCardsOf, orphanDispatchesOf, reportGroups, type DetailRow, type DetailTabKey, type OrderCard, type ServiceDetail } from '@lilachat/shared';
import type { OpenSheetFile } from './RecordSheetWeb';
import { DETAIL_TONE } from './tones';

const KICKER = 'font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant';
const CARD = 'overflow-hidden rounded-2xl border border-outline/15 bg-surface';
const Chip = ({ row }: { row: DetailRow }) => <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</span>;

/** José 30/10: the row opens its sheet inside Lilachat; the file opens in Lilachat's viewer, not in Portal. */
function RowView({ row, icon, onOpen, onOpenFile }: { row: DetailRow; icon?: boolean; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  return (
    <li data-testid={`fila-${row.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-2.5">
      {icon ? <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText size={18} /></span> : null}
      <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold hover:underline">{row.title}</p>
        {row.line ? <p className="truncate text-[12px] text-on-surface-variant">{row.line}</p> : null}
      </button>
      <Chip row={row} />
      {row.file ? (
        <button type="button" onClick={() => row.file && onOpenFile({ url: row.file.url, name: `${row.title} · ${row.file.label}` })} data-testid={`archivo-${row.id}`} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-outline/20 px-2.5 text-[12px] font-semibold text-on-surface hover:bg-background"><FileText size={14} /> {row.file.label}</button>
      ) : null}
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
          <ul className={`divide-y divide-outline/10 ${CARD}`}>{group.rows.map((row) => <RowView key={row.id} row={row} icon onOpen={onOpen} onOpenFile={onOpenFile} />)}</ul>
        </section>
      ))}
    </div>
  );
}

/** A dispatch inside its order: the truck, its quantity and hour, its first pictures (design cc-02). */
function DispatchLine({ dispatch, onOpen, onOpenFile }: { dispatch: OrderCard['dispatches'][number]; onOpen: (id: string) => void; onOpenFile: OpenSheetFile }) {
  const all = dispatch.pictures.map((picture) => ({ url: picture.url, name: picture.name ?? dispatch.title, mime: picture.mime, ...(picture.thumbUrl ? { thumbUrl: picture.thumbUrl } : {}) }));
  return (
    <li data-testid={`despacho-${dispatch.id}`} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-outline/10 bg-background/60 px-3 py-2">
      <button type="button" onClick={() => onOpen(dispatch.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Truck size={17} className="shrink-0 text-primary" />
        <span className="font-mono text-[13px] font-bold text-on-surface">{dispatch.title}</span>
        {dispatch.line ? <span className="truncate text-[13px] text-on-surface-variant">{`· ${dispatch.line}`}</span> : null}
      </button>
      <span className="flex shrink-0 gap-1.5">
        {all.map((picture) => (
          <button key={picture.url} type="button" aria-label={`Ver ${picture.name}`} onClick={() => onOpenFile(picture, all)} className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
            {picture.mime.startsWith('image/') ? <img src={picture.thumbUrl ?? picture.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon size={16} />}
          </button>
        ))}
      </span>
    </li>
  );
}

/** One order as a card with its dispatches inside (José 01/11, design cc-02); its head opens its sheet. */
function OrderCardView({ card, onOpen, onOpenDispatch, onOpenFile }: { card: OrderCard; onOpen: (id: string) => void; onOpenDispatch: (id: string) => void; onOpenFile: OpenSheetFile }) {
  const { order } = card;
  return (
    <article data-testid={`fila-${order.id}`} className={`${CARD} p-4`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onOpen(order.id)} className="min-w-0 flex-1 text-left">
          <p className="text-[15px] font-bold text-on-surface hover:underline">{order.title}</p>
          {order.line ? <p className="text-[13px] text-on-surface-variant">{order.line}</p> : null}
        </button>
        <Chip row={order} />
      </div>
      {card.dispatches.length ? (
        <>
          <p className={`mt-3 ${KICKER}`}>{`Despachos · ${card.dispatches.length}`}</p>
          <ul className="mt-2 flex flex-col gap-2">{card.dispatches.map((one) => <DispatchLine key={one.id} dispatch={one} onOpen={onOpenDispatch} onOpenFile={onOpenFile} />)}</ul>
          {card.dispatches.some((one) => one.cubicage) ? <button type="button" onClick={() => onOpen(order.id)} className="mt-2 inline-flex h-9 items-center gap-1.5 text-[13px] font-semibold text-primary"><Ruler size={15} /> Cubicaje</button> : null}
        </>
      ) : (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-background/60 px-3 py-3 text-[13px] text-on-surface-variant"><Clock size={15} /> Sin despachos todavía</p>
      )}
    </article>
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
      {orderCardsOf(detail).map((card) => <OrderCardView key={card.order.id} card={card} onOpen={onOpen} onOpenDispatch={onOpenDispatch} onOpenFile={onOpenFile} />)}
      <OrphanDispatches detail={detail} onOpen={onOpenDispatch} onOpenFile={onOpenFile} />
    </>
  );
}
