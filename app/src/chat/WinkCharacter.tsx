import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { WINK_ART, WINK_PROPS, type CharacterWink, type WinkArt } from '@lilachat/shared';

/** The art of a sketch's tile: its character, or its prop for a wink without one (the water balloon). */
function tileArt(wink: CharacterWink): WinkArt | undefined {
  return wink.tile ? WINK_PROPS[wink.tile] : WINK_ART[wink.id as keyof typeof WINK_ART];
}

/**
 * The still tile of a sketch in the «Guiños» panel: ONE SVG layer (a dozen
 * tiles of several layers each would parse a hundred SVGs at once). The sketch
 * itself plays in `WinkSketch`.
 */
export function WinkCharacter({ wink, size }: { wink: CharacterWink; size: number }) {
  const art = tileArt(wink);
  const xml = useMemo(() => (art ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}">${art.defs ? `<defs>${art.defs}</defs>` : ''}${art.parts.map((part) => part.markup).join('')}</svg>` : ''), [art]);
  if (!art) return null;
  const [, , width = 1, height = 1] = art.viewBox.split(/\s+/).map(Number);
  return (
    <View style={{ width: size, height: (size * height) / width }}>
      <SvgXml xml={xml} width={size} height={(size * height) / width} />
    </View>
  );
}
