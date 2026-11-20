import { useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, ChevronLeft, ExternalLink, Link2, MoreVertical } from 'lucide-react-native';
import { CLIENT_SERVICE_STATUS_LABELS, serviceHeadLine, serviceSlimLine, type ServiceTabItem, type ServiceTabKey, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { STATUS_TONE } from './tones';

/** How much of the previous tab stays visible when one scrolls into view. */
const TAB_SCROLL_MARGIN = 24;
const KICKER = 'text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant';

const StatusChip = ({ service }: { service: SpaceClientService }) => (
  <Text className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[service.status]}`}>{CLIENT_SERVICE_STATUS_LABELS[service.status]}</Text>
);

const Progress = ({ value }: { value?: number }) => (value === undefined ? null : (
  <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-variant"><View className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></View>
));

type HeadProps = { service: SpaceClientService; clientName?: string; onBack: () => void; onShare?: () => void; portalUrl?: string };

/** «⋯» of the head: what the service has outside Lilachat. Without it, no button. */
function MoreButton(props: { portalUrl?: string }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const { portalUrl } = props;
  if (!portalUrl) return null;
  return (
    <View>
      <Pressable testID="servicio-mas" accessibilityLabel="Más opciones" onPress={() => setOpen(!open)} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20 bg-surface"><MoreVertical size={18} color={colors['on-surface']} /></Pressable>
      {open ? (
        <View className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-outline/15 bg-surface p-1.5" style={{ elevation: 6 }}>
          <Pressable testID="abrir-servicio-portal" onPress={() => { setOpen(false); void Linking.openURL(portalUrl); }} className="min-h-[44px] flex-row items-center gap-2 rounded-lg px-3">
            <ExternalLink size={16} color={colors['on-surface']} />
            <Text className="text-[14px] font-semibold text-on-surface">Abrir en el Portal</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** A tablet (cc-02 tablet): «‹ Servicios», the kicker, the name with its state, its line and bar; link and «⋯» on the right. */
function WideHead(props: HeadProps) {
  const colors = useColores();
  const line = serviceHeadLine(props.service);
  return (
    <View className="flex-row items-start gap-3 px-4 pt-3">
      <Pressable testID="volver-a-servicios" onPress={props.onBack} className="min-h-[44px] flex-row items-center gap-1 rounded-xl border border-outline/20 px-3">
        <ChevronLeft size={16} color={colors.primary} />
        <Text className="text-[14px] font-semibold text-primary">Servicios</Text>
      </Pressable>
      <View className="min-w-0 flex-1">
        {props.clientName ? <Text className={KICKER} numberOfLines={1}>{`Servicio · ${props.clientName}`}</Text> : null}
        <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
          <Text testID="servicio-nombre" className="text-[19px] font-extrabold text-on-surface">{props.service.name}</Text>
          <StatusChip service={props.service} />
        </View>
        {line ? <Text testID="servicio-linea" className="mt-1 text-[13px] text-on-surface-variant">{line}</Text> : null}
        <View className="w-48"><Progress value={props.service.progress} /></View>
      </View>
      {props.onShare ? (
        <Pressable testID="enlace-servicio" onPress={props.onShare} className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl border border-outline/20 bg-surface px-3">
          <Link2 size={16} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-on-surface">Enlace del servicio</Text>
        </Pressable>
      ) : null}
      <MoreButton portalUrl={props.portalUrl} />
    </View>
  );
}

/** A phone (cc-02 mobile): back arrow, client and name; link and «⋯»; under it the state, the line and the bar. */
function CompactHead(props: HeadProps) {
  const colors = useColores();
  const line = serviceHeadLine(props.service);
  return (
    <View className="px-3 pt-2">
      <View className="flex-row items-center gap-2">
        <Pressable testID="volver-a-servicios" accessibilityLabel="Volver a Servicios" onPress={props.onBack} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20"><ArrowLeft size={19} color={colors['on-surface']} /></Pressable>
        <View className="min-w-0 flex-1">
          {props.clientName ? <Text className={KICKER} numberOfLines={1}>{props.clientName}</Text> : null}
          <Text testID="servicio-nombre" className="text-[16px] font-extrabold text-on-surface" numberOfLines={1}>{props.service.name}</Text>
        </View>
        {props.onShare ? <Pressable testID="enlace-servicio" accessibilityLabel="Enlace del servicio" onPress={props.onShare} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20"><Link2 size={18} color={colors['on-surface']} /></Pressable> : null}
        <MoreButton portalUrl={props.portalUrl} />
      </View>
      <View className="mt-2 flex-row items-center gap-2 px-1">
        <StatusChip service={props.service} />
        {line ? <Text testID="servicio-linea" className="min-w-0 flex-1 text-[13px] text-on-surface-variant" numberOfLines={1}>{line}</Text> : null}
      </View>
      <View className="px-1"><Progress value={props.service.progress} /></View>
    </View>
  );
}

const LinkButton = (props: { onShare?: () => void }) => {
  const colors = useColores();
  if (!props.onShare) return null;
  return <Pressable testID="enlace-servicio" accessibilityLabel="Enlace del servicio" onPress={props.onShare} className="h-11 w-11 items-center justify-center rounded-xl border border-outline/20"><Link2 size={18} color={colors['on-surface']} /></Pressable>;
};

/**
 * The map's head (José 20/11, design mapa-v2): ONE row so the map takes the rest. On a phone the
 * name with «client · progress» under it; on a tablet «‹ Servicios», the name, its state and line.
 * Link and «⋯» on the right, as in the other sections.
 */
function SlimHead(props: HeadProps & { compact: boolean }) {
  const colors = useColores();
  const line = props.compact ? serviceSlimLine(props.service, props.clientName) : serviceHeadLine(props.service);
  return (
    <View testID="cabecera-servicio-mapa" className="flex-row items-center gap-2 px-3 pt-1.5">
      {props.compact
        ? <Pressable testID="volver-a-servicios" accessibilityLabel="Volver a Servicios" onPress={props.onBack} className="h-11 w-11 items-center justify-center rounded-xl"><ArrowLeft size={19} color={colors['on-surface']} /></Pressable>
        : <Pressable testID="volver-a-servicios" onPress={props.onBack} className="min-h-[44px] flex-row items-center gap-1 pr-2"><ChevronLeft size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Servicios</Text></Pressable>}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text testID="servicio-nombre" className="shrink text-[15px] font-extrabold text-on-surface" numberOfLines={1}>{props.service.name}</Text>
          {props.compact ? null : <StatusChip service={props.service} />}
        </View>
        {line ? <Text testID="servicio-linea" className="text-[12px] text-on-surface-variant" numberOfLines={1}>{line}</Text> : null}
      </View>
      <LinkButton onShare={props.onShare} />
      <MoreButton portalUrl={props.portalUrl} />
    </View>
  );
}

/** One underlined bar (design cc-02): the tab touched scrolls whole into view; the section's actions at its right. */
function TabBar(props: { tabs: ServiceTabItem[]; tab: ServiceTabKey; onTab: (tab: ServiceTabKey) => void; actions?: ReactNode; /** Lower tabs under the map's one-row head. */ dense?: boolean }) {
  const strip = useRef<ScrollView>(null);
  const starts = useRef<Partial<Record<ServiceTabKey, number>>>({});
  const pick = (key: ServiceTabKey) => {
    props.onTab(key);
    strip.current?.scrollTo({ x: Math.max(0, (starts.current[key] ?? 0) - TAB_SCROLL_MARGIN), animated: true });
  };
  return (
    <View className={`${props.dense ? 'mt-1' : 'mt-2'} flex-row items-center border-t border-outline/10 pr-3`}>
      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}>
        {props.tabs.map((one) => {
          const open = one.key === props.tab;
          return (
            <Pressable key={one.key} testID={`pestana-detalle-${one.key}`} onLayout={(event) => (starts.current[one.key] = event.nativeEvent.layout.x)} onPress={() => pick(one.key)} accessibilityRole="tab" accessibilityState={{ selected: open }} className={`${props.dense ? 'min-h-[40px]' : 'min-h-[46px]'} flex-row items-center gap-1.5 border-b-2 ${open ? 'border-primary' : 'border-transparent'}`}>
              <Text className={`text-[15px] ${open ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>{one.label}</Text>
              {one.count !== undefined ? <Text className={`rounded-full px-1.5 text-[11px] font-bold ${open ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>{one.count}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {props.actions ? <View testID="acciones-seccion" className="flex-row items-center gap-2 py-1">{props.actions}</View> : null}
    </View>
  );
}

export type ServiceShellProps = HeadProps & { compact: boolean; /** The map open: its one-row head (José 20/11, design mapa-v2). */ slim?: boolean; tabs: ServiceTabItem[]; tab: ServiceTabKey; onTab: (tab: ServiceTabKey) => void; /** The open section's buttons, at the right of the bar («Crear informe»). */ actions?: ReactNode; children: ReactNode };

/**
 * An open service, the same in its four sections (José 19/11, designs cc-02…cc-05): the head and
 * ONE underlined bar Pedidos · Informes · Mapa · Drive. No crumbs: «‹ Servicios» on a tablet, the
 * back arrow on a phone (and Android's BACK).
 */
export function ServiceShell(props: ServiceShellProps) {
  return (
    <View testID="detalle-servicio" className="flex-1 bg-background">
      <View testID="cabecera-servicio" className="z-20 border-b border-outline/15 bg-surface">
        {props.slim ? <SlimHead {...props} /> : props.compact ? <CompactHead {...props} /> : <WideHead {...props} />}
        <TabBar tabs={props.tabs} tab={props.tab} onTab={props.onTab} actions={props.actions} dense={props.slim} />
      </View>
      {props.children}
    </View>
  );
}
