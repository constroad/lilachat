import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Clock, FileText, Ruler, Truck } from 'lucide-react-native';
import { detailEmptyText, detailRows, dispatchThumbSlotsFor, dispatchThumbs, orderCardsOf, orphanDispatchesOf, reportGroups, type DetailRow, type DetailTabKey, type OrderCard, type ServiceDetail, type ViewableFile } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { FileThumb } from './FileThumb';
import { DETAIL_TONE } from './tones';

type OpenFile = (file: ViewableFile, siblings?: readonly ViewableFile[]) => void;
const KICKER = 'text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant';
const CARD = 'overflow-hidden rounded-2xl border border-outline/15 bg-surface';

const Chip = ({ row }: { row: DetailRow }) => <Text className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</Text>;

/** A report or a dispatch row: it opens its sheet; the file opens in Lilachat's viewer (José 30/10). */
function RowView({ row, icon, onOpen, onOpenFile }: { row: DetailRow; icon?: boolean; onOpen: (id: string) => void; onOpenFile: OpenFile }) {
  const colors = useColores();
  const file = row.file;
  return (
    <Pressable testID={`fila-${row.id}`} onPress={() => onOpen(row.id)} className="min-h-[64px] flex-row items-center gap-3 border-b border-outline/10 px-3 py-2.5">
      {icon ? <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><FileText size={18} color={colors.primary} /></View> : null}
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>{row.title}</Text>
        {row.line ? <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{row.line}</Text> : null}
      </View>
      <Chip row={row} />
      {file ? (
        <Pressable testID={`archivo-${row.id}`} onPress={() => onOpenFile({ url: file.url, name: `${row.title} · ${file.label}` })} className="min-h-[40px] flex-row items-center gap-1 rounded-lg border border-outline/20 px-2.5">
          <FileText size={14} color={colors['on-surface']} />
          <Text className="text-[12px] font-semibold text-on-surface">{file.label}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** The reports under a header per day (José 31/10), as cards (design cc-03). */
function ReportDays({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: OpenFile }) {
  return (
    <View className="gap-4">
      {reportGroups(detail).map((group) => (
        <View key={group.title} testID={`dia-informes-${group.title}`}>
          <View className="mb-2 flex-row justify-between px-1">
            <Text className={KICKER}>{group.title}</Text>
            <Text className="text-[12px] text-on-surface-variant">{group.rows.length === 1 ? '1 informe' : `${group.rows.length} informes`}</Text>
          </View>
          <View className={CARD}>{group.rows.map((row) => <RowView key={row.id} row={row} icon onOpen={onOpen} onOpenFile={onOpenFile} />)}</View>
        </View>
      ))}
    </View>
  );
}

const THUMB_DP = 44;

/**
 * A dispatch's thumbs (José 20/11: the APK showed none): what fits the window, a «+K» tile for the
 * rest, and any of them opens the viewer with ALL its photos and videos. Same `FileThumb` as its sheet.
 */
function DispatchThumbs({ dispatch, onOpenFile }: { dispatch: OrderCard['dispatches'][number]; onOpenFile: OpenFile }) {
  const { width } = useWindowDimensions();
  const { media } = dispatch;
  const { shown, more } = dispatchThumbs(media, dispatchThumbSlotsFor(width));
  const firstHidden = media[shown.length];
  return (
    <>
      {shown.map((one, index) => (
        <Pressable key={one.url} testID={`despacho-foto-${index}`} accessibilityLabel={`Ver ${one.name}`} onPress={() => onOpenFile(one, media)}>
          <FileThumb file={one} size={THUMB_DP} />
        </Pressable>
      ))}
      {more && firstHidden ? (
        <Pressable testID={`despacho-mas-${dispatch.id}`} accessibilityLabel={`Ver ${more} más`} onPress={() => onOpenFile(firstHidden, media)} style={{ width: THUMB_DP, height: THUMB_DP }} className="items-center justify-center rounded-lg bg-primary/10">
          <Text className="text-[13px] font-bold text-primary">{`+${more}`}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

/** A dispatch inside its order: the truck, its quantity and hour, its thumbs (design cc-02). */
function DispatchLine({ dispatch, onOpen, onOpenFile }: { dispatch: OrderCard['dispatches'][number]; onOpen: (id: string) => void; onOpenFile: OpenFile }) {
  const colors = useColores();
  return (
    <View testID={`despacho-${dispatch.id}`} className="min-h-[56px] flex-row items-center gap-2 rounded-xl border border-outline/10 bg-background px-3 py-2">
      <Pressable onPress={() => onOpen(dispatch.id)} className="min-w-0 flex-1 flex-row items-center gap-2">
        <Truck size={17} color={colors.primary} />
        <View className="min-w-0 flex-1">
          <Text className="font-mono text-[13px] font-bold text-on-surface">{dispatch.title}</Text>
          {dispatch.line ? <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{dispatch.line}</Text> : null}
        </View>
      </Pressable>
      {dispatch.media.length ? <DispatchThumbs dispatch={dispatch} onOpenFile={onOpenFile} /> : null}
    </View>
  );
}

/** One order as a card with its dispatches inside (José 01/11, design cc-02); its head opens its sheet. */
function OrderCardView({ card, onOpen, onOpenDispatch, onOpenFile }: { card: OrderCard; onOpen: (id: string) => void; onOpenDispatch: (id: string) => void; onOpenFile: OpenFile }) {
  const colors = useColores();
  const { order } = card;
  return (
    <View testID={`fila-${order.id}`} className={`${CARD} p-4`}>
      <Pressable onPress={() => onOpen(order.id)} className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-bold text-on-surface">{order.title}</Text>
          {order.line ? <Text className="text-[13px] text-on-surface-variant">{order.line}</Text> : null}
        </View>
        <Chip row={order} />
      </Pressable>
      {card.dispatches.length ? (
        <View className="mt-3 gap-2">
          <Text className={KICKER}>{`Despachos · ${card.dispatches.length}`}</Text>
          {card.dispatches.map((one) => <DispatchLine key={one.id} dispatch={one} onOpen={onOpenDispatch} onOpenFile={onOpenFile} />)}
          {card.dispatches.some((one) => one.cubicage) ? (
            <Pressable onPress={() => onOpen(order.id)} className="min-h-[40px] flex-row items-center gap-1.5">
              <Ruler size={15} color={colors.primary} />
              <Text className="text-[13px] font-semibold text-primary">Cubicaje</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-background px-3 py-3">
          <Clock size={15} color={colors['on-surface-variant']} />
          <Text className="text-[13px] text-on-surface-variant">Sin despachos todavía</Text>
        </View>
      )}
    </View>
  );
}

/** Dispatches whose order did not come in the 100 Portal sent (José 01/11). */
function OrphanDispatches({ detail, onOpen, onOpenFile }: { detail: ServiceDetail; onOpen: (id: string) => void; onOpenFile: OpenFile }) {
  const rows = orphanDispatchesOf(detail);
  if (!rows.length) return null;
  return (
    <View testID="despachos-sin-pedido" className={CARD}>
      <Text className={`bg-surface-variant/40 px-3 py-1.5 ${KICKER}`}>Despachos de otros pedidos</Text>
      {rows.map((row) => <RowView key={row.id} row={row} onOpen={onOpen} onOpenFile={onOpenFile} />)}
    </View>
  );
}

/** The open list: orders as cards with their dispatches, reports by day. */
export function ServiceList({ detail, tab, onOpen, onOpenDispatch, onOpenFile }: { detail: ServiceDetail; tab: DetailTabKey; onOpen: (id: string) => void; onOpenDispatch: (id: string) => void; onOpenFile: OpenFile }) {
  if (!detailRows(detail, tab).length) return <Text className={`${CARD} p-4 text-[14px] text-on-surface-variant`}>{detailEmptyText(tab, detail.totals)}</Text>;
  if (tab === 'reports') return <ReportDays detail={detail} onOpen={onOpen} onOpenFile={onOpenFile} />;
  return (
    <>
      {orderCardsOf(detail).map((card) => <OrderCardView key={card.order.id} card={card} onOpen={onOpen} onOpenDispatch={onOpenDispatch} onOpenFile={onOpenFile} />)}
      <OrphanDispatches detail={detail} onOpen={onOpenDispatch} onOpenFile={onOpenFile} />
    </>
  );
}
