import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { ChevronRight, Clock, ExternalLink, FileText, Link2, Package } from 'lucide-react-native';
import { CLIENT_SERVICE_STATUS_LABELS, serviceCardFacts, serviceTakesScreen, type ServiceCardFacts, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { STATUS_TONE } from './tones';

const ACCENT: Record<SpaceClientService['status'], string> = { pending: 'border-l-warning', in_progress: 'border-l-primary', completed: 'border-l-en-linea', rejected: 'border-l-error' };
/** What a column says when Portal did not send its figure: never a made-up number. */
const MISSING = '—';
const KICKER = 'text-[10px] font-bold uppercase tracking-[1.4px] text-on-surface-variant';

function StatusPill({ service }: { service: SpaceClientService }) {
  return <Text className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{service.stage_label || CLIENT_SERVICE_STATUS_LABELS[service.status]}</Text>;
}

function ProgressBar({ progress }: { progress: number }) {
  return <View className="h-1.5 overflow-hidden rounded-full bg-background"><View className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></View>;
}

function FigureColumn(props: { label: string; value?: number; testID: string }) {
  return (
    <View className="items-center border-l border-outline/15 px-3">
      <Text className={KICKER}>{props.label}</Text>
      <Text testID={props.testID} className="text-[20px] font-extrabold text-on-surface">{props.value === undefined ? MISSING : String(props.value)}</Text>
    </View>
  );
}

/** Design cc-01 on a tablet: one row with the name, the progress and the figures in columns. */
function WideSummary({ service, facts }: { service: SpaceClientService; facts: ServiceCardFacts }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="min-w-0 flex-[1.6]">
        <Text numberOfLines={1} className="text-[15px] font-bold text-on-surface">{service.name}</Text>
        {facts.startLine ? <Text testID={`inicio-servicio-${service.id}`} className="mt-1 text-[12px] text-on-surface-variant">{facts.startLine}</Text> : null}
      </View>
      <View className="min-w-0 flex-[0.9] gap-1.5">
        <View className="flex-row items-center gap-2"><StatusPill service={service} />{service.progress !== undefined ? <Text className="text-[13px] font-bold text-on-surface">{`${service.progress} %`}</Text> : null}</View>
        {service.progress !== undefined ? <ProgressBar progress={service.progress} /> : null}
      </View>
      <FigureColumn label="Pedidos" value={facts.ordersCount} testID={`pedidos-servicio-${service.id}`} />
      <FigureColumn label="Informes" value={facts.reportsCount} testID={`informes-servicio-${service.id}`} />
      <View className="min-w-0 flex-[1.4] border-l border-outline/15 pl-3">
        <Text className={KICKER}>Último movimiento</Text>
        <Text testID={`movimiento-servicio-${service.id}`} numberOfLines={1} className="text-[14px] text-on-surface">{facts.lastActivity ? `${facts.lastActivity.when} · ${facts.lastActivity.text}` : MISSING}</Text>
      </View>
    </View>
  );
}

/** Design cc-01 on a phone: «N pedidos · N informes · hora» and the bar «Último movimiento: … ›», only with what came. */
function CompactFacts({ service, facts }: { service: SpaceClientService; facts: ServiceCardFacts }) {
  const colors = useColores();
  if (!facts.ordersLabel && !facts.reportsLabel && !facts.lastActivity) return null;
  return (
    <View className="mt-3 border-t border-outline/15 pt-3">
      <View className="flex-row items-center gap-4">
        {facts.ordersLabel ? <View className="flex-row items-center gap-1.5"><Package size={15} color={colors['on-surface-variant']} /><Text testID={`pedidos-servicio-${service.id}`} className="text-[13px] font-semibold text-on-surface">{facts.ordersLabel}</Text></View> : null}
        {facts.reportsLabel ? <View className="flex-row items-center gap-1.5"><FileText size={15} color={colors['on-surface-variant']} /><Text testID={`informes-servicio-${service.id}`} className="text-[13px] font-semibold text-on-surface">{facts.reportsLabel}</Text></View> : null}
        {facts.lastActivity ? <View className="ml-auto flex-row items-center gap-1"><Clock size={14} color={colors['on-surface-variant']} /><Text className="text-[12px] text-on-surface-variant">{facts.lastActivity.when}</Text></View> : null}
      </View>
      {facts.lastActivity ? (
        <View testID={`movimiento-servicio-${service.id}`} className="mt-2.5 flex-row items-center gap-1 rounded-xl border border-outline/20 px-3 py-2">
          <Text numberOfLines={1} className="flex-1 text-[13px] text-on-surface-variant">Último movimiento: <Text className="font-semibold text-on-surface">{facts.lastActivity.text}</Text></Text>
          <ChevronRight size={15} color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

function CompactSummary({ service, facts }: { service: SpaceClientService; facts: ServiceCardFacts }) {
  return (
    <>
      <View className="flex-row items-start gap-3">
        <Text className="flex-1 text-[15px] font-bold text-on-surface">{service.name}</Text>
        <StatusPill service={service} />
      </View>
      {service.progress !== undefined ? (
        <View className="mt-3">
          <View className="mb-1.5 flex-row justify-between"><Text className="text-[13px] text-on-surface-variant">Avance</Text><Text className="text-[13px] font-bold text-on-surface">{`${service.progress} %`}</Text></View>
          <ProgressBar progress={service.progress} />
        </View>
      ) : null}
      {/* José 31/10: «la lista de servicios no muestra la fecha». */}
      {facts.startLine ? <Text testID={`inicio-servicio-${service.id}`} className="mt-2 text-[12px] text-on-surface-variant">{facts.startLine}</Text> : null}
      <CompactFacts service={service} facts={facts} />
    </>
  );
}

/**
 * A service of «Servicios» (José 19/11, design cc-01): a row with columns on a tablet, a card on a
 * phone. Tapping it opens the service, or its Portal link without the space. «Enlace del servicio»
 * stays on it (José 31/10).
 */
export function ServiceCard(props: { service: SpaceClientService; canOpen: boolean; onOpen: () => void; onShare?: () => void }) {
  const colors = useColores();
  const { width, height } = useWindowDimensions();
  const { service } = props;
  const facts = serviceCardFacts(service, new Date());
  const action = props.canOpen ? props.onOpen : service.url ? () => service.url && void Linking.openURL(service.url) : undefined;
  return (
    <View testID={`servicio-${service.id}`} className={`rounded-2xl border border-l-4 border-outline/15 bg-surface p-4 ${ACCENT[service.status]}`}>
      <Pressable testID={`abrir-servicio-${service.id}`} disabled={!action} onPress={action}>
        {serviceTakesScreen(width, height) ? <CompactSummary service={service} facts={facts} /> : <WideSummary service={service} facts={facts} />}
        {action && !props.canOpen ? (
          <View className="mt-3 min-h-[36px] flex-row items-center gap-1.5">
            <Text className="text-[14px] font-semibold text-primary">Ver en el Portal</Text>
            <ExternalLink size={15} color={colors.primary} />
          </View>
        ) : null}
      </Pressable>
      {props.onShare ? (
        <Pressable testID={`enlace-servicio-${service.id}`} onPress={props.onShare} className="mt-2 min-h-[40px] flex-row items-center gap-1.5 self-start rounded-lg border border-outline/20 px-3">
          <Link2 size={15} color={colors.primary} />
          <Text className="text-[13px] font-semibold text-primary">Enlace del servicio</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
