import { useState } from 'react';
import { Linking, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Minus, Navigation, Plus, Radio, WifiOff, X } from 'lucide-react-native';
import { LIVE_MAP_DEFAULT_ZOOM, accuracyLabel, clampMapZoom, liveCaption, liveStaleCaption, liveState, locationMapLink, type LiveLocation } from '@lilachat/shared';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';
import { MapSnippet } from './MapSnippet';

const HEADER_HEIGHT = 64;
const FOOTER_HEIGHT = 120;
const ZOOM_BUTTON = 44;

/**
 * The map inside the app (pending 12): the whole screen, centred on the point
 * and following it while it is live — the card above re-renders with each new
 * position. Same OpenStreetMap tiles as the card, no map SDK; zoom with
 * buttons, and «Cómo llegar» hands over to the phone's maps app.
 */
export function LiveMapScreen(props: { visible: boolean; location: LiveLocation; now: Date; clock: (iso: string) => string; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(LIVE_MAP_DEFAULT_ZOOM);
  const live = liveState(props.location, props.now) === 'live';
  const caption = liveCaption(props.location, props.now, props.clock);
  const stale = liveStaleCaption(props.location, props.now, props.clock);
  const mapHeight = Math.max(200, height - HEADER_HEIGHT - FOOTER_HEIGHT - margins.cabecera - margins.pie);
  const zoomButton = (testID: string, next: number, Icon: typeof Plus) => (
    <Pressable testID={testID} accessibilityRole="button" onPress={() => setZoom(clampMapZoom(next))} className="items-center justify-center rounded-full bg-surface shadow" style={{ width: ZOOM_BUTTON, height: ZOOM_BUTTON }}>
      <Icon size={20} color={colors['on-surface']} />
    </Pressable>
  );
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
      <View testID="mapa-en-vivo" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera, paddingBottom: margins.pie }}>
        <View className="flex-row items-center gap-3 px-2" style={{ height: HEADER_HEIGHT }}>
          <Pressable testID="btn-cerrar-mapa" accessibilityLabel="Cerrar el mapa" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full">
            <X size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-semibold text-on-surface">{caption ? 'Ubicación en tiempo real' : 'Ubicación'}</Text>
            {caption ? <Text className="text-[13px] text-on-surface-variant">{caption}</Text> : null}
          </View>
        </View>
        <View>
          <MapSnippet location={props.location} width={width} height={mapHeight} zoom={zoom} />
          <View className="absolute right-3 top-3 gap-2">
            {zoomButton('btn-acercar-mapa', zoom + 1, Plus)}
            {zoomButton('btn-alejar-mapa', zoom - 1, Minus)}
          </View>
        </View>
        <View className="gap-1 px-4 pt-3" style={{ minHeight: FOOTER_HEIGHT }}>
          {stale ? (
            <View className="flex-row items-center gap-1.5">
              <WifiOff size={14} color={colors.error} />
              <Text testID="sin-senal" className="text-[13px] text-error">{stale}</Text>
            </View>
          ) : live ? (
            <View className="flex-row items-center gap-1.5">
              <Radio size={14} color={colors.primary} />
              <Text className="text-[13px] text-on-surface-variant">Se mueve con su teléfono</Text>
            </View>
          ) : null}
          {props.location.accuracy !== undefined ? <Text className="text-[13px] text-on-surface-variant">{accuracyLabel(props.location.accuracy)}</Text> : null}
          <Pressable testID="btn-como-llegar" onPress={() => void Linking.openURL(locationMapLink(props.location))} className="mt-2 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-primary">
            <Navigation size={16} color={colors['on-primary']} />
            <Text className="text-[15px] font-semibold text-on-primary">Cómo llegar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
