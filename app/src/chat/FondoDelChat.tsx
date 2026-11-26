import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { wallpaperPatternSvg } from '@lilachat/shared';
import { useTema } from '../ui/tema';

/**
 * The conversation's background: the road works doodles of `shared/chatWallpaper` (José 26/11: the chat looked too
 * white, «like Telegram or WhatsApp»), behind chats, channels and groups, the same tile as the web. ONE `Svg` with a
 * 256 px pattern that repeats: no image to load or decode. It does not move with the scroll.
 */
export const FondoDelChat = memo(function FondoDelChat() {
  const { oscuro, colores } = useTema();
  const xml = useMemo(() => wallpaperPatternSvg(oscuro ? 'dark' : 'light', colores['fondo-chat']), [oscuro, colores]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SvgXml xml={xml} width="100%" height="100%" />
    </View>
  );
});
