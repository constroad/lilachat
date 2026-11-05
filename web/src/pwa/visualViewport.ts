/** Less than this is a browser bar coming and going, not a keyboard. */
const KEYBOARD_MIN_PX = 120;
const NO_ZOOM_MAX_SCALE = 1.01;

type Viewport = Pick<VisualViewport, 'height' | 'scale'>;

/** `null` under a pinch zoom: the viewport shrinks too and the app must stay as it is. */
export function viewportState(viewport: Viewport, layoutHeight: number): { height: number; keyboardOpen: boolean } | null {
  if (viewport.scale > NO_ZOOM_MAX_SCALE) return null;
  return { height: Math.round(viewport.height), keyboardOpen: layoutHeight - viewport.height > KEYBOARD_MIN_PX };
}

/**
 * The keyboard in a phone's browser (spec §3.3, the worst failure for a chat):
 * Safari shrinks `visualViewport` and leaves the layout as it was, so the
 * composer stays under the keyboard. The app's height follows it through
 * `--app-height`; `data-keyboard` drops the home bar's padding meanwhile.
 */
export function followVisualViewport(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => undefined;
  const root = document.documentElement;
  const apply = () => {
    const state = viewportState(viewport, window.innerHeight);
    if (!state) return;
    root.style.setProperty('--app-height', `${state.height}px`);
    root.toggleAttribute('data-keyboard', state.keyboardOpen);
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  };
  viewport.addEventListener('resize', apply);
  viewport.addEventListener('scroll', apply);
  apply();
  return () => {
    viewport.removeEventListener('resize', apply);
    viewport.removeEventListener('scroll', apply);
  };
}
