import { useEffect } from 'react';
import { runOnJS, useFrameCallback } from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { beginInteraction, endInteractionAfterPaint, setUiSampler, uiFrame } from './frameMonitor';

/**
 * Mounted once at the root (inside `KeyboardProvider`). It gives `frameMonitor`
 * the UI thread: Reanimated's frame callback, active only while an interaction
 * is open. It also measures the keyboard from here, because the keyboard is
 * global: «teclado-abrir» from the moment it starts to rise until it settles,
 * «teclado-cerrar» the other way.
 */
const keyboardStarts = (height: number) => beginInteraction(height > 0 ? 'teclado-abrir' : 'teclado-cerrar');
const keyboardEnds = (height: number) => endInteractionAfterPaint(height > 0 ? 'teclado-abrir' : 'teclado-cerrar');

export function FrameMonitorHost() {
  const sampler = useFrameCallback((frame) => {
    'worklet';
    if (frame.timeSincePreviousFrame !== null) runOnJS(uiFrame)(frame.timeSincePreviousFrame);
  }, false);

  useEffect(() => {
    setUiSampler({ start: () => sampler.setActive(true), stop: () => sampler.setActive(false) });
    return () => setUiSampler(null);
  }, [sampler]);

  useKeyboardHandler(
    {
      onStart: (event) => {
        'worklet';
        runOnJS(keyboardStarts)(event.height);
      },
      onEnd: (event) => {
        'worklet';
        runOnJS(keyboardEnds)(event.height);
      },
    },
    []
  );

  return null;
}
