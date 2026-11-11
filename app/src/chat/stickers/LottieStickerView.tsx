import { forwardRef, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import { ANIMATED_STICKER_PLAY_MS } from '@lilachat/shared';

/**
 * A sticker of the animated pack as Lottie (José 11/11, like Telegram's):
 * vector and 60 fps, a few KB instead of a 300 KB WebP. The WebP shows still
 * under it until the file loads, and stays if it cannot load.
 */
export const LottieStickerView = forwardRef<LottieView, { lottieUrl: string; webpUrl: string; side: number }>(function LottieStickerView(props, ref) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const size = { width: props.side, height: props.side };
  if (failed) return <Image source={{ uri: props.webpUrl }} style={size} contentFit="contain" />;
  return (
    <View style={size}>
      {loaded ? null : <Image source={{ uri: props.webpUrl }} style={[size, { position: 'absolute' }]} contentFit="contain" autoplay={false} />}
      <LottieView ref={ref} source={{ uri: props.lottieUrl }} style={size} autoPlay loop resizeMode="contain" onAnimationLoaded={() => setLoaded(true)} onAnimationFailure={() => setFailed(true)} />
    </View>
  );
});

/** Like WhatsApp, it plays for a while and stops where it was; a tap plays it again. */
export function useLottieStop(active: boolean) {
  const ref = useRef<LottieView>(null);
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      ref.current?.pause();
      setStopped(true);
    }, ANIMATED_STICKER_PLAY_MS);
    return () => clearTimeout(timer);
  }, [active, round]);
  const replay = () => {
    ref.current?.resume();
    setStopped(false);
    setRound((before) => before + 1);
  };
  return { ref, stopped: active && stopped, replay };
}
