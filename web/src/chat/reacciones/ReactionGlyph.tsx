import { reactionGlyph } from '@lilachat/shared';
import { useSpaceEmojis } from '../../spaces/customEmojis';
import { useConversacion } from '../contextoDeLaConversacion';

/** One reaction: the emoji, or the space's own image for `:name:` (pending 19). */
export function ReactionGlyph({ emoji, size }: { emoji: string; size: number }) {
  const { jwt, chat } = useConversacion();
  const { byName } = useSpaceEmojis(jwt, chat.workspaceId);
  const glyph = reactionGlyph(emoji, byName);
  if (glyph.kind === 'image') return <img src={glyph.url} alt={`:${glyph.name}:`} title={`:${glyph.name}:`} width={size} height={size} className="inline-block object-contain" />;
  if (glyph.text.startsWith(':')) return <span className="font-mono text-[11px] text-on-surface-variant">{glyph.text}</span>;
  return <span style={{ fontSize: size * 0.9 }}>{glyph.text}</span>;
}
