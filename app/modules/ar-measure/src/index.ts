import type { ComponentType, Ref } from 'react';
import type { ViewProps } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ArPoint } from '@lilachat/shared';

/** A point on the view, in its own pixels; `visible` is false behind the camera or off the screen. */
export type ScreenPoint = { x: number; y: number; visible: boolean };
export type ArState = 'tracking' | 'searching' | 'installing' | 'declined' | 'unsupported' | 'no-permission' | 'error';
/** What the AR sees, ten times a second (la-02): the floor under the center and each corner on the screen. */
export type ArFrame = { state: ArState; reason?: string | null; floor: boolean; distance?: number | null; aim?: ScreenPoint | null; corners: ScreenPoint[]; stable: boolean; width?: number; height?: number };
export type ArReading = { points: ArPoint[]; stable: boolean };
export type ArAvailability = 'ready' | 'install' | 'unsupported' | 'unknown';

/** The view's requests; each rejects with a code (`no-floor`, `far`, `not-tracking`, `paused`) and a line for the person. */
export type ArMeasureHandle = {
  addCorner(): Promise<number>;
  undoCorner(): Promise<number>;
  readCorners(): Promise<ArReading>;
  clearCorners(): Promise<number>;
};

type NativeProps = ViewProps & { ref?: Ref<ArMeasureHandle>; onArFrame?: (event: { nativeEvent: ArFrame }) => void };

const native = requireOptionalNativeModule<{ availability(): Promise<ArAvailability> }>('ArMeasure');

/** Whether this phone measures with AR; `unsupported` in a build without the module (or on the web). */
export const arAvailability = (): Promise<ArAvailability> => native?.availability() ?? Promise.resolve('unsupported');

/** The camera with ARCore behind the measure; null in a build without the module. */
export const ArMeasureView: ComponentType<NativeProps> | null = native ? requireNativeView<NativeProps>('ArMeasure') : null;
