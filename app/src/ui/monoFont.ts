import { Platform } from 'react-native';

/** A real monospace on each platform: NativeWind's `font-mono` asks Android for a «mono» family it does not have. */
export const MONO_FONT = Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' });
