import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { Timemark } from '@lilachat/shared';
import { fitContain } from '../crop/cropMath';
import { StampOverlay } from './StampOverlay';

/** The stamp a shot showed when it was taken: «Enviar» shows it the same (José 13/11). */
export type SeenStamp = { stamp: Timemark; logoUrl: string | null };

/** The camera records 720p: upright on a phone held upright, sideways otherwise. */
const VIDEO_LONG = 1280;
const VIDEO_SHORT = 720;

/**
 * A shot in «Enviar» with the stamp over it, where the server burns it (José 13/11: «en el
 * preview no se ve el sello»). The picture is drawn «contain», so the stamp sits on the picture's
 * own rectangle, not on the black around it.
 */
export function StampedPreview(props: { seen: SeenStamp | undefined; width?: number; height?: number; children: ReactNode }) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  const upright = box ? box.height >= box.width : true;
  const media = { width: props.width ?? (upright ? VIDEO_SHORT : VIDEO_LONG), height: props.height ?? (upright ? VIDEO_LONG : VIDEO_SHORT) };
  const frame = box && props.seen ? fitContain(media.width, media.height, box.width, box.height) : null;
  return (
    <View testID="vista-con-sello" className="flex-1 self-stretch" onLayout={onLayout}>
      {props.children}
      {frame && props.seen ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
          <StampOverlay stamp={props.seen.stamp} logoUrl={props.seen.logoUrl} width={frame.width} height={frame.height} bottomInset={0} topInset={0} rightInset={0} />
        </View>
      ) : null}
    </View>
  );
}
