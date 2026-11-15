import type { ComponentType, Ref } from 'react';
import type { ViewProps } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ArPoint } from '@lilachat/shared';

/** A point on the view, in its own pixels; `visible` is false behind the camera or off the screen. */
export type ScreenPoint = { x: number; y: number; visible: boolean };
export type ArState = 'tracking' | 'searching' | 'installing' | 'declined' | 'unsupported' | 'no-permission' | 'error';
/**
 * What the AR sees, twenty times a second (la-02): the floor scanned so far, the
 * floor under the center, each corner on the screen, the length of each side
 * and of the side being drawn, and whether the aim snapped to the first corner.
 */
export type ArFrame = { state: ArState; reason?: string | null; floor: boolean; distance?: number | null; aim?: ScreenPoint | null; corners: ScreenPoint[]; stable: boolean; width?: number; height?: number; floorM2?: number; closing?: boolean; closed?: boolean; areaM2?: number; live?: number | null; sides?: number[] };
/** The corners in meters and, when it could be read, the AR's frame with the trace (`file://`). */
export type ArReading = { points: ArPoint[]; stable: boolean; photo?: string };
export type ArAvailability = 'ready' | 'install' | 'unsupported' | 'unknown';

/** The view's requests; each rejects with a code (`no-floor`, `far`, `not-tracking`, `closing`, `paused`) and a line for the person. */
export type ArMeasureHandle = {
  addCorner(): Promise<number>;
  undoCorner(): Promise<number>;
  readCorners(): Promise<ArReading>;
  clearCorners(): Promise<number>;
  /** Closes the zone in the AR, filled with its area (m²); «Deshacer» (`undoCorner`) opens it again. */
  closeZone(): Promise<number>;
  reopenZone(): Promise<number>;
};

type NativeProps = ViewProps & { ref?: Ref<ArMeasureHandle>; accent?: string; onArFrame?: (event: { nativeEvent: ArFrame }) => void };

const native = requireOptionalNativeModule<{ availability(): Promise<ArAvailability> }>('ArMeasure');

/** Whether this phone measures with AR; `unsupported` in a build without the module (or on the web). */
export const arAvailability = (): Promise<ArAvailability> => native?.availability() ?? Promise.resolve('unsupported');

/** The camera with ARCore behind the measure; null in a build without the module. */
export const ArMeasureView: ComponentType<NativeProps> | null = native ? requireNativeView<NativeProps>('ArMeasure') : null;
