import { StyleSheet, View } from 'react-native';
import { RTCView, type MediaStream } from 'react-native-webrtc';

/**
 * The call in Android's small window (José 13/11: «debería minimizarse como WhatsApp»): only the
 * other's video, no buttons (the window is too small to tap). Drawn in the app's own view, not in
 * the call's Modal, which is a dialog Android does not carry into the small window. Without the
 * other's video yet, my own fills it.
 */
export function PipCallView(props: { remote: MediaStream | null; local: MediaStream | null }) {
  const stream = props.remote ?? props.local;
  return (
    <View testID="llamada-ventana-chica" style={StyleSheet.absoluteFill} className="bg-black">
      {stream ? <RTCView streamURL={stream.toURL()} objectFit="cover" mirror={!props.remote} zOrder={0} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}
