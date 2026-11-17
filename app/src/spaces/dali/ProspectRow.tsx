import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Clock, Phone } from 'lucide-react-native';
import { inboxAttendantOf, overdueLabelOf, overdueOf, prospectNameOf, prospectTimeOf, type ProspectView } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { inicialesDe } from '../../ui/avatarMotor';
import { useColores } from '../../ui/tema';
import { OriginPill, Pill, ScorePill, StagePill } from './daliParts';

/** The row's circle (dp): as in the phone design, beside the name. */
const ROW_AVATAR = 32;
/** The seller's circle at the end of the pills (dp). */
const SELLER_AVATAR = 28;
/** The phone inside the circle of a prospect without a name, against the circle's side. */
const PHONE_ICON_SCALE = 0.45;
const OVERDUE_ICON = 14;

/** A prospect's circle: the app's avatar, with a phone while it has no name yet (dl-01 v3), as on the web. */
export function ProspectAvatar({ name, size }: { name: string; size: number }) {
  const colors = useColores();
  const phone = inicialesDe(name) ? undefined : <Phone size={Math.round(size * PHONE_ICON_SCALE)} color={colors.primary} />;
  return <Avatar nombre={name} tamano={size} icono={phone} />;
}

type RowProps = { prospect: ProspectView; unread?: number; selected: boolean; now: Date; onOpen: (prospect: ProspectView) => void };

/**
 * A prospect in the inbox (dl-01 v3): the circle, the name and when, the service (the company line Stitch drew has
 * no field: the service goes there, on its own line as on the web), what Dali understood, what is late, and the pills
 * (origin, score, stage) with who attends it. The pills give way instead of wrapping: the origin first, so the stage
 * stays whole; who attends never does. Selected = its conversation is open beside it (a tablet's two panes).
 */
export const ProspectRow = memo(function ProspectRow(props: RowProps) {
  const colors = useColores();
  const { prospect, now, selected } = props;
  const overdue = overdueOf(prospect, now);
  return (
    <Pressable
      testID={`fila-prospecto-${prospect.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => props.onOpen(prospect)}
      android_ripple={{ color: colors.outline }}
      className={`overflow-hidden rounded-xl border px-4 py-3 ${selected ? 'border-primary/40 bg-primary/5' : 'border-outline/15 bg-surface'}`}
    >
      {selected ? <View className="absolute bottom-0 left-0 top-0 w-[3px] bg-primary" /> : null}
      <NameLine prospect={prospect} unread={props.unread ?? 0} selected={selected} now={now} />
      {prospect.service ? <Text numberOfLines={1} className="mt-0.5 text-[13px] text-on-surface-variant">{prospect.service.name}</Text> : null}
      {prospect.summary ? <Text numberOfLines={2} className="mt-1 text-[14px] leading-5 text-on-surface">{prospect.summary}</Text> : null}
      {overdue ? (
        <View testID="vencido-prospecto" className="mt-1 flex-row items-center gap-1">
          <Clock size={OVERDUE_ICON} color={colors.warning} />
          <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] font-medium text-warning">{overdueLabelOf(overdue, now)}</Text>
        </View>
      ) : null}
      <View className="mt-2 flex-row items-center gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-1 overflow-hidden">
          <OriginPill prospect={prospect} shrink="first" />
          <ScorePill score={prospect.score} />
          <StagePill prospect={prospect} />
        </View>
        <Attendant prospect={prospect} now={now} />
      </View>
    </Pressable>
  );
});

/** The circle, the name (heavier with something unread), when, and how many are unread. */
function NameLine({ prospect, unread, selected, now }: { prospect: ProspectView; unread: number; selected: boolean; now: Date }) {
  const name = prospectNameOf(prospect);
  const accent = unread > 0 || selected;
  return (
    <View className="flex-row items-center gap-2.5">
      <ProspectAvatar name={name} size={ROW_AVATAR} />
      <Text numberOfLines={1} className={`min-w-0 flex-1 text-[15px] text-on-surface ${unread > 0 ? 'font-extrabold' : 'font-bold'}`}>
        {name}
      </Text>
      <Text className={`shrink-0 text-[12px] ${accent ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{prospectTimeOf(prospect.lastActivityAt, now)}</Text>
      {unread > 0 ? (
        <View testID="sin-leer-prospecto" className="h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[11px] font-bold text-on-primary">{String(unread)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The seller's circle; «Sin asignar» when nobody took one that needs it now; «Dali» while Dali converses alone. */
function Attendant({ prospect, now }: { prospect: ProspectView; now: Date }) {
  const attendant = inboxAttendantOf(prospect, now);
  if (!attendant) return null;
  if (attendant.kind === 'seller') {
    return (
      <View accessible accessibilityLabel={`Atiende ${attendant.name}`} className="shrink-0">
        <Avatar nombre={attendant.name} tamano={SELLER_AVATAR} />
      </View>
    );
  }
  return attendant.kind === 'unassigned' ? <Pill tone="warn">Sin asignar</Pill> : <Pill tone="primary">Dali</Pill>;
}
