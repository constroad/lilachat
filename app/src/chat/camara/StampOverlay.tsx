import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { timemarkLayoutOf, timemarkLogoBoxOf, type Timemark } from '@lilachat/shared';

const ACCENT = '#8b5cf6';
const SHADOW = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;

type Props = { stamp: Timemark; logoUrl: string | null; width: number; height: number; bottomInset: number; topInset: number; rightInset: number };

/**
 * The live stamp over the camera and over the photo to review (designs cam-01/02/03): bottom left,
 * the hour big, the date and the weekday beside it, the address and the GPS under it. The space's
 * logo, when its chip is on, sits apart at the top right like Timemark (José 13/11), below the
 * camera's own buttons. Sized by the frame's short side, the same rule the server burns with.
 */
export function StampOverlay(props: Props) {
  const box = timemarkLogoBoxOf(props.width, props.height);
  return (
    <>
      <StampLines {...props} />
      {props.logoUrl ? <Image testID="sello-logo" source={{ uri: props.logoUrl }} pointerEvents="none" style={{ position: 'absolute', top: props.topInset + box.y, right: props.rightInset + box.y, width: box.size, height: box.size, borderRadius: box.radius }} contentFit="cover" /> : null}
    </>
  );
}

function StampLines(props: Props) {
  const look = timemarkLayoutOf(props.width, props.height);
  const white = { color: 'white' } as const;
  return (
    <View testID="sello-en-vivo" pointerEvents="none" className="absolute left-0" style={{ bottom: props.bottomInset + look.margin, paddingLeft: look.margin, paddingRight: look.margin }}>
      <View className="flex-row items-center" style={{ gap: look.margin / 2 }}>
        <Text style={[white, SHADOW, { fontSize: look.hourSize, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{props.stamp.hour}</Text>
        <View style={{ width: look.bar, alignSelf: 'stretch', marginVertical: look.hourSize * 0.18, backgroundColor: ACCENT }} />
        <View>
          <Text style={[white, SHADOW, { fontSize: look.lineSize, fontWeight: '700' }]}>{props.stamp.date}</Text>
          <Text style={[white, SHADOW, { fontSize: look.lineSize, opacity: 0.85 }]}>{props.stamp.weekday}</Text>
        </View>
      </View>
      {props.stamp.address ? <Text testID="sello-direccion" numberOfLines={1} style={[white, SHADOW, { fontSize: look.lineSize, fontWeight: '600', maxWidth: props.width - look.margin * 2 }]}>{props.stamp.address}</Text> : null}
      {props.stamp.coords ? <Text numberOfLines={1} style={[white, SHADOW, { fontSize: look.smallSize, opacity: 0.85 }]}>{props.stamp.coords}</Text> : null}
    </View>
  );
}
