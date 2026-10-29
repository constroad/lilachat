import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { ExternalLink, Radio } from 'lucide-react-native';
import { accuracyLabel, liveCaption, liveState, locationMapLink, type LiveLocation } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { MapSnippet } from './MapSnippet';
import { stopLiveSharing } from './liveLocationTask';

const CARD_WIDTH = 260;
const MAP_HEIGHT = 140;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** «Now», again when a live location runs out, so the card turns to «Ya no comparte» by itself. */
function useNowUntil(liveUntil: string | undefined): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const left = liveUntil ? new Date(liveUntil).getTime() - Date.now() : 0;
    if (!(left > 0)) return undefined;
    const timer = setTimeout(() => setNow(new Date()), left + 500);
    return () => clearTimeout(timer);
  }, [liveUntil]);
  return now;
}

/** `mine` = I sent it (I can stop it); `onOwnBubble` = drawn on my coloured bubble, not in a flat row. */
type Props = { location: LiveLocation; mine: boolean; onOwnBubble?: boolean; live?: { jwt: string; chatId: string; seq: number } };

/**
 * A location shared in the chat (pending 11, design `r152-ubicacion`): the
 * map, the accuracy and «Abrir en el mapa». A live one says until when it
 * follows the phone, and its author can stop it.
 */
export function LocationCard(props: Props) {
  const colors = useColores();
  const now = useNowUntil(props.location.endedAt ? undefined : props.location.liveUntil);
  const [stopping, setStopping] = useState(false);
  const open = () => void Linking.openURL(locationMapLink(props.location));
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
      <Pressable onPress={open} accessibilityLabel="Abrir la ubicación en el mapa" className="m-1 mb-0 overflow-hidden rounded-lg">
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
        {props.location.accuracy !== undefined ? <Text className={`text-[13px] ${soft}`}>{accuracyLabel(props.location.accuracy)}</Text> : null}
      </View>
      <Pressable testID="btn-abrir-mapa" onPress={open} className={`mx-3 mt-2 h-10 flex-row items-center justify-center gap-1.5 rounded-xl border ${tinted ? 'border-white/30' : 'border-primary/25 bg-primary/[0.06]'}`}>
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
