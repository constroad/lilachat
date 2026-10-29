import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { LocateFixed, MapPin, Radio } from 'lucide-react-native';
import { accuracyLabel, LIVE_LOCATION_MINUTES, type LiveLocationMinutes, type SharedLocation } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { MapSnippet } from './MapSnippet';
import { useCurrentLocation } from './useCurrentLocation';

const SHEET_PADDING = 16;
const MAP_HEIGHT = 180;
const LIVE_LABELS: Record<LiveLocationMinutes, string> = { 15: '15 min', 60: '1 hora', 480: '8 horas' };

/**
 * «Ubicación» in the clip (pending 11, design `r152-ubicacion`): the phone's
 * current location on a small map with its accuracy, and «Enviar ubicación».
 * Each state says what is going on: looking, no permission, no fix. Under it,
 * «En tiempo real» for 15 min, 1 h or 8 h: the card follows the phone.
 */
export function ShareLocationSheet(props: { visible: boolean; onClose: () => void; onSend: (location: SharedLocation, liveMinutes?: LiveLocationMinutes) => Promise<boolean> }) {
  const colors = useColores();
  const margins = useMargenes();
  const { width } = useWindowDimensions();
  const { current, retry } = useCurrentLocation(props.visible);
  const [sending, setSending] = useState(false);
  const mapWidth = width - SHEET_PADDING * 2;
  const send = async (location: SharedLocation, liveMinutes?: LiveLocationMinutes) => {
    setSending(true);
    const sent = await props.onSend(location, liveMinutes);
    setSending(false);
    if (sent) props.onClose();
  };
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-ubicacion" className="rounded-t-3xl bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
        <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <Text className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Compartir ubicación</Text>
        <View className="overflow-hidden rounded-2xl border border-outline/15" style={{ width: mapWidth, height: MAP_HEIGHT }}>
          {current.state === 'ready' ? (
            <MapSnippet location={current.location} width={mapWidth} height={MAP_HEIGHT} testID="mapa-ubicacion-actual" />
          ) : (
            <View className="flex-1 items-center justify-center gap-3 bg-surface-variant px-6">
              {current.state === 'locating' ? <ActivityIndicator color={colors.primary} /> : null}
              <Text testID="estado-ubicacion" className="text-center text-[14px] text-on-surface">
                {current.state === 'locating' ? 'Buscando tu ubicación…' : current.state === 'denied' ? 'Permite la ubicación para compartirla en el chat.' : 'No se pudo obtener tu ubicación. Revisa que la ubicación del teléfono esté encendida.'}
              </Text>
              {current.state === 'denied' ? (
                <Pressable testID="btn-ajustes-ubicacion" onPress={() => void Linking.openSettings()} className="h-10 items-center justify-center rounded-full bg-primary px-5">
                  <Text className="text-[13px] font-semibold text-on-primary">Abrir ajustes</Text>
                </Pressable>
              ) : current.state === 'error' ? (
                <Pressable testID="btn-reintentar-ubicacion" onPress={retry} className="h-10 items-center justify-center rounded-full bg-primary px-5">
                  <Text className="text-[13px] font-semibold text-on-primary">Reintentar</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
        {current.state === 'ready' ? (
          <View className="mt-3 flex-row items-center gap-2">
            <LocateFixed size={16} color={colors.primary} />
            <Text className="text-[14px] text-on-surface">Tu ubicación actual{current.location.accuracy !== undefined ? ` · ${accuracyLabel(current.location.accuracy).toLowerCase()}` : ''}</Text>
          </View>
        ) : null}
        <Pressable
          testID="btn-enviar-ubicacion"
          disabled={current.state !== 'ready' || sending}
          onPress={() => current.state === 'ready' && void send(current.location)}
          className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary ${current.state !== 'ready' || sending ? 'opacity-40' : ''}`}
        >
          {sending ? <ActivityIndicator color={colors['on-primary']} /> : <MapPin size={18} color={colors['on-primary']} />}
          <Text className="text-[15px] font-semibold text-on-primary">Enviar ubicación</Text>
        </Pressable>
        <View className="mt-4 flex-row items-center gap-2">
          <Radio size={16} color={colors.primary} />
          <Text className="text-[13px] font-semibold text-on-surface">Compartir en tiempo real</Text>
        </View>
        <View className="mt-2 flex-row gap-2">
          {LIVE_LOCATION_MINUTES.map((minutes) => (
            <Pressable
              key={minutes}
              testID={`btn-tiempo-real-${minutes}`}
              accessibilityLabel={`Compartir en tiempo real por ${LIVE_LABELS[minutes]}`}
              disabled={current.state !== 'ready' || sending}
              onPress={() => current.state === 'ready' && void send(current.location, minutes)}
              className={`h-11 flex-1 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.06] ${current.state !== 'ready' || sending ? 'opacity-40' : ''}`}
            >
              <Text className="text-[14px] font-semibold text-primary">{LIVE_LABELS[minutes]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable testID="btn-cancelar-ubicacion" onPress={props.onClose} className="mt-1 h-12 items-center justify-center">
          <Text className="text-[15px] text-on-surface-variant">Cancelar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
