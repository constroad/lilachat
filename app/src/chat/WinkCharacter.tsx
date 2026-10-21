import { View } from 'react-native';
import { Image } from 'expo-image';
import { WINK_ART, WINK_PROPS, type CharacterWink } from '@lilachat/shared';
import { WINK_IMAGES } from './winkImages';

/** The tile's art: its character, or its prop for a wink without one (the water balloon). */
function tileArtId(wink: CharacterWink): string {
  return wink.tile ?? wink.id;
}

/**
 * The still tile of a sketch: the «Guiños» panel and the wink's card in the
 * chat (José, 21/10: a thumbnail to see which wink it was). An IMAGE, not a
 * live SVG: a chat with a dozen winks parsed and redrew a dozen SVGs while
 * scrolling. The sketch itself plays in `WinkSketch`.
 */
export function WinkCharacter({ wink, size }: { wink: CharacterWink; size: number }) {
  const id = tileArtId(wink);
  const art = WINK_ART[id as keyof typeof WINK_ART] ?? WINK_PROPS[id as keyof typeof WINK_PROPS];
  const tile = WINK_IMAGES[id]?.tile;
  if (!art || !tile) return null;
  const [, , width = 1, height = 1] = art.viewBox.split(/\s+/).map(Number);
  return (
    <View style={{ width: size, height: (size * height) / width }}>
      <Image source={tile} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </View>
  );
}
