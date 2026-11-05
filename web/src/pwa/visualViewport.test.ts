import { afterEach, describe, expect, it, vi } from 'vitest';
import { followVisualViewport, viewportState } from './visualViewport';

/** Spec §3.3: in Safari the keyboard covers the composer unless the app follows `visualViewport`. */
type Handler = () => void;
function fakeViewport(start: { height: number; scale?: number }) {
  const handlers = new Map<string, Handler>();
  const viewport = { height: start.height, scale: start.scale ?? 1, addEventListener: (name: string, handler: Handler) => handlers.set(name, handler), removeEventListener: (name: string) => handlers.delete(name) };
  vi.stubGlobal('visualViewport', viewport);
  return { viewport, fire: (name: string) => handlers.get(name)?.(), handlers };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-keyboard');
  document.documentElement.style.removeProperty('--app-height');
});

describe('viewportState', () => {
  it('the keyboard takes more than a browser bar', () => {
    expect(viewportState({ height: 500, scale: 1 }, 844)).toEqual({ height: 500, keyboardOpen: true });
    expect(viewportState({ height: 780, scale: 1 }, 844)).toEqual({ height: 780, keyboardOpen: false });
  });

  it('a pinch zoom shrinks the viewport too: it is not a keyboard, nothing changes', () => {
    expect(viewportState({ height: 422, scale: 2 }, 844)).toBeNull();
  });
});

describe('followVisualViewport', () => {
  it('writes the height for the CSS and marks the open keyboard', () => {
    // Arrange
    const { viewport, fire } = fakeViewport({ height: 844 });
    vi.stubGlobal('innerHeight', 844);
    followVisualViewport();
    // Act
    viewport.height = 500;
    fire('resize');
    // Assert
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('500px');
    expect(document.documentElement.hasAttribute('data-keyboard')).toBe(true);
  });

  it('closing the keyboard takes the mark off', () => {
    // Arrange
    const { viewport, fire } = fakeViewport({ height: 500 });
    vi.stubGlobal('innerHeight', 844);
    followVisualViewport();
    // Act
    viewport.height = 844;
    fire('resize');
    // Assert
    expect(document.documentElement.hasAttribute('data-keyboard')).toBe(false);
  });

  it('Safari scrolls the page to show the field: it goes back, or the header leaves the screen', () => {
    // Arrange
    const { fire } = fakeViewport({ height: 500 });
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 120);
    followVisualViewport();
    // Act
    fire('scroll');
    // Assert
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('without the API it does nothing and the CSS falls back to 100dvh', () => {
    vi.stubGlobal('visualViewport', undefined);
    expect(() => followVisualViewport()()).not.toThrow();
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('');
  });

  it('stops when it is told to', () => {
    const { handlers } = fakeViewport({ height: 844 });
    followVisualViewport()();
    expect(handlers.size).toBe(0);
  });
});
