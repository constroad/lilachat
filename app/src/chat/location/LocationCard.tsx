import { Linking, Pressable, Text, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { accuracyLabel, locationMapLink, type SharedLocation } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { MapSnippet } from './MapSnippet';

const CARD_WIDTH = 260;
const MAP_HEIGHT = 140;

/** A location shared in the chat (pending 11, design `r152-ubicacion`): the map, the accuracy and «Abrir en el mapa». */
export function LocationCard(props: { location: SharedLocation; mine: boolean }) {
  const colors = useColores();
  const open = () => void Linking.openURL(locationMapLink(props.location));
  const soft = props.mine ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant';
  return (
    <View testID="tarjeta-ubicacion" style={{ width: CARD_WIDTH }}>
      <Pressable onPress={open} accessibilityLabel="Abrir la ubicación en el mapa" className="m-1 mb-0 overflow-hidden rounded-lg">
        <MapSnippet location={props.location} width={CARD_WIDTH - 8} height={MAP_HEIGHT} testID="mapa-ubicacion" />
      </Pressable>
      <View className="px-3 pt-2">
        <Text className={`text-[15px] font-semibold ${props.mine ? 'text-on-burbuja-propia' : 'text-on-surface'}`}>Ubicación</Text>
        {props.location.accuracy !== undefined ? <Text className={`text-[13px] ${soft}`}>{accuracyLabel(props.location.accuracy)}</Text> : null}
      </View>
      <Pressable testID="btn-abrir-mapa" onPress={open} className={`mx-3 mt-2 h-10 flex-row items-center justify-center gap-1.5 rounded-xl border ${props.mine ? 'border-white/30' : 'border-primary/25 bg-primary/[0.06]'}`}>
        <Text className={`text-[14px] font-semibold ${props.mine ? 'text-on-burbuja-propia' : 'text-primary'}`}>Abrir en el mapa</Text>
        <ExternalLink size={15} color={props.mine ? colors['on-burbuja-propia'] : colors.primary} />
      </Pressable>
    </View>
  );
}
