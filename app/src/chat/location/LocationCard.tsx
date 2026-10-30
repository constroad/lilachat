import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { ExternalLink, Radio, WifiOff } from 'lucide-react-native';
import { LIVE_KEEPALIVE_MS, accuracyLabel, liveCaption, liveStaleCaption, liveState, locationMapLink, type LiveLocation } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { MapSnippet } from './MapSnippet';
import { LiveMapScreen } from './LiveMapScreen';
import { stopLiveSharing } from './liveLocationTask';

const CARD_WIDTH = 260;
const MAP_HEIGHT = 140;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * «Now» while a live location lasts: once a keep-alive, so «Sin señal desde»
 * shows when the points stop (pending 12), and the card turns to «Ya no
 * comparte» by itself when the time runs out.
 */
function useNowUntil(liveUntil: string | undefined): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!liveUntil || new Date(liveUntil).getTime() <= Date.now()) return undefined;
    const timer = setInterval(() => setNow(new Date()), LIVE_KEEPALIVE_MS);
    return () => clearInterval(timer);
  }, [liveUntil]);
  return now;
}

/** `mine` = I sent it (I can stop it); `onOwnBubble` = drawn on my coloured bubble, not in a flat row. */
type Props = {
  location: LiveLocation;
  mine: boolean;
  onOwnBubble?: boolean;
  live?: { jwt: string; chatId: string; seq: number };
  /** The row's selection: a long press selects (E2E 28/10: it opened Maps), and while selecting a tap does too. */
  selecting?: boolean;
  onSelect?: () => void;
};

/**
 * A location shared in the chat (pending 11, design `r152-ubicacion`): the
 * map, the accuracy and «Abrir en el mapa». A live one says until when it
 * follows the phone, and its author can stop it.
 */
export function LocationCard(props: Props) {
  const colors = useColores();
  const now = useNowUntil(props.location.endedAt ? undefined : props.location.liveUntil);
  const [stopping, setStopping] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const open = () => (props.selecting && props.onSelect ? props.onSelect() : void Linking.openURL(locationMapLink(props.location)));
  // Pending 12: the map itself opens inside the app; «Abrir en el mapa» still hands over to Maps.
  const openMap = () => (props.selecting && props.onSelect ? props.onSelect() : setMapOpen(true));
  const stale = liveStaleCaption(props.location, now, clock);
  const tinted = props.onOwnBubble ?? props.mine;
  const soft = tinted ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant';
  const caption = liveCaption(props.location, now, clock);
  const canStop = props.mine && props.live && liveState(props.location, now) === 'live';
  const stop = async () => {
    if (!props.live) return;
    setStopping(true);
    await stopLiveSharing(props.live.jwt, props.live.chatId, props.live.seq);
    setStopping(false);
  };
  return (
    <View testID="tarjeta-ubicacion" style={{ width: CARD_WIDTH }}>
      <LiveMapScreen visible={mapOpen} location={props.location} now={now} clock={clock} onClose={() => setMapOpen(false)} />
      <Pressable testID="btn-ver-mapa" onPress={openMap} onLongPress={props.onSelect} delayLongPress={350} accessibilityLabel="Ver la ubicación en el mapa" className="m-1 mb-0 overflow-hidden rounded-lg">
        <MapSnippet location={props.location} width={CARD_WIDTH - 8} height={MAP_HEIGHT} testID="mapa-ubicacion" />
      </Pressable>
      <View className="px-3 pt-2">
        <Text className={`text-[15px] font-semibold ${tinted ? 'text-on-burbuja-propia' : 'text-on-surface'}`}>{caption ? 'Ubicación en tiempo real' : 'Ubicación'}</Text>
        {caption ? (
          <View className="flex-row items-center gap-1">
            {liveState(props.location, now) === 'live' ? <Radio size={13} color={tinted ? colors['on-burbuja-propia'] : colors.primary} /> : null}
            <Text testID="estado-tiempo-real" className={`text-[13px] ${soft}`}>{caption}</Text>
          </View>
        ) : null}
        {stale ? (
          <View className="flex-row items-center gap-1">
            <WifiOff size={13} color={tinted ? colors['on-burbuja-propia'] : colors.error} />
            <Text testID="sin-senal" className={`text-[13px] ${tinted ? soft : 'text-error'}`}>{stale}</Text>
          </View>
        ) : null}
        {props.location.accuracy !== undefined ? <Text className={`text-[13px] ${soft}`}>{accuracyLabel(props.location.accuracy)}</Text> : null}
      </View>
      <Pressable testID="btn-abrir-mapa" onPress={open} onLongPress={props.onSelect} delayLongPress={350} className={`mx-3 mt-2 h-10 flex-row items-center justify-center gap-1.5 rounded-xl border ${tinted ? 'border-white/30' : 'border-primary/25 bg-primary/[0.06]'}`}>
        <Text className={`text-[14px] font-semibold ${tinted ? 'text-on-burbuja-propia' : 'text-primary'}`}>Abrir en el mapa</Text>
        <ExternalLink size={15} color={tinted ? colors['on-burbuja-propia'] : colors.primary} />
      </Pressable>
      {canStop ? (
        <Pressable testID="btn-dejar-de-compartir" disabled={stopping} onPress={() => void stop()} className="mx-3 mt-1 h-10 flex-row items-center justify-center gap-2">
          {stopping ? <ActivityIndicator size="small" color={tinted ? colors['on-burbuja-propia'] : colors.primary} /> : null}
          <Text className={`text-[14px] font-semibold ${tinted ? 'text-on-burbuja-propia' : 'text-primary'}`}>Dejar de compartir</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
