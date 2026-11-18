import { memo, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { GalleryHorizontal, Link2, LockKeyhole, Play } from 'lucide-react-native';
import { platformLabel, vividPulse, type LinkCard } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { placeholderKindOf } from './linkView';

/** The 3:4 of a reel's cover (Stitch nl-01: 56 × 75 dp). */
export const THUMB_ASPECT = 3 / 4;
const THUMB_ICON = 22;
const THUMB_RADIUS = vividPulse.radius.thumb;

/**
 * The cover of a saved link: its image, cached on disk and recycled by URL, or
 * a flat tinted square with what it is (a play for a reel) when it has none or
 * it does not load.
 */
export const LinkThumb = memo(function LinkThumb({ link, width }: { link: LinkCard; width: number }) {
  const colors = useColores();
  const [broken, setBroken] = useState(false);
  const size = { width, height: Math.round(width / THUMB_ASPECT) };
  if (link.imageUrl && !broken && link.status !== 'unreadable') {
    return <Image recyclingKey={link.imageUrl} source={{ uri: link.imageUrl }} style={[size, { borderRadius: THUMB_RADIUS }]} contentFit="cover" cachePolicy="memory-disk" transition={120} onError={() => setBroken(true)} />;
  }
  const kind = placeholderKindOf(link);
  const Icon = kind === 'play' ? Play : kind === 'post' ? GalleryHorizontal : kind === 'locked' ? LockKeyhole : Link2;
  return (
    <View style={size} className={`items-center justify-center rounded-thumb ${kind === 'locked' ? 'bg-on-surface/[0.06]' : 'bg-primary/[0.12]'}`}>
      <Icon size={THUMB_ICON} color={kind === 'locked' ? colors['on-surface-variant'] : colors.primary} fill={kind === 'play' ? colors.primary : 'transparent'} />
    </View>
  );
});

/** «INSTAGRAM · REEL», on one line always and never cut: the title beside it is what shrinks (review 18/11). */
export function PlatformPill({ link, tone = 'dark' }: { link: LinkCard; tone?: 'dark' | 'soft' }) {
  return (
    <View className={`shrink-0 rounded-md px-1.5 py-0.5 ${tone === 'dark' ? 'bg-on-surface' : 'bg-primary/[0.12]'}`}>
      <Text numberOfLines={1} className={`text-[10px] font-bold tracking-wider ${tone === 'dark' ? 'text-surface' : 'text-on-surface-variant'}`}>
        {platformLabel(link)}
      </Text>
    </View>
  );
}

/** «SOLO PIDE COMENTAR» or «NO SE PUDO LEER»: what the card needs a look for. */
export function ReviewPill({ kind }: { kind: 'commentBait' | 'unreadable' }) {
  const bait = kind === 'commentBait';
  return (
    <View className={`self-start rounded-md px-1.5 py-0.5 ${bait ? 'bg-warning/[0.16]' : 'bg-error/[0.12]'}`}>
      <Text className={`text-[11px] font-bold ${bait ? 'text-warning' : 'text-error'}`}>{bait ? 'SOLO PIDE COMENTAR' : 'NO SE PUDO LEER'}</Text>
    </View>
  );
}
