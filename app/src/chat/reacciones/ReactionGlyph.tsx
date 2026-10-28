import { Text } from 'react-native';
import { Image } from 'expo-image';
import { reactionGlyph } from '@lilachat/shared';
import { useSpaceEmojis } from '../../spaces/customEmojis';

/** One reaction: the emoji, or the space's own image for `:name:` (pending 19). */
export function ReactionGlyph(props: { emoji: string; size: number }) {
  const space = useSpaceEmojis();
  const glyph = reactionGlyph(props.emoji, space?.byName);
  if (glyph.kind === 'image') {
    return <Image source={{ uri: glyph.url }} style={{ width: props.size, height: props.size }} contentFit="contain" accessibilityLabel={`:${glyph.name}:`} />;
  }
  const isName = glyph.text.startsWith(':');
  return <Text style={{ fontSize: isName ? Math.round(props.size * 0.5) : props.size * 0.9 }} className={isName ? 'font-mono text-on-surface-variant' : ''}>{glyph.text}</Text>;
}
