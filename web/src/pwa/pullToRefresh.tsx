import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';

/** How far the indicator has to come down to refresh. */
export const PULL_TRIGGER_PX = 70;
const PULL_RESISTANCE = 0.5;
const PULL_MAX_PX = 110;

/** The list moves less than the finger, like a phone's own pull. */
export const pullOffset = (fingerPx: number): number => Math.min(Math.max(fingerPx, 0) * PULL_RESISTANCE, PULL_MAX_PX);

/**
 * A pull starts only on the list itself, at its top. React bubbles the touch of a
 * sheet opened from the list through its portal, and that one is not the list.
 */
function canPullFrom(start: EventTarget | null, list: HTMLElement | null): boolean {
  if (!list || !(start instanceof Node) || !list.contains(start)) return false;
  for (let node = start as HTMLElement | null; node && node !== list; node = node.parentElement) {
    if (node.scrollTop > 0) return false;
  }
  return true;
}

/**
 * Pulling the list down with the finger (José 06/11). On a phone the page itself
 * never scrolls (`index.css` fixes the body, for the keyboard), so the browser's
 * own pull has nothing to pull: this one does it, and a reload is also what brings
 * a new version of the web.
 */
export function PullToRefresh(props: { onRefresh: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pulled, setPulled] = useState(0);
  const begin = (event: TouchEvent) => {
    startY.current = canPullFrom(event.target, box.current) ? event.touches[0]?.clientY ?? null : null;
  };
  const move = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY;
    if (startY.current !== null && y !== undefined) setPulled(pullOffset(y - startY.current));
  };
  const end = () => {
    if (pulled >= PULL_TRIGGER_PX) props.onRefresh();
    startY.current = null;
    setPulled(0);
  };
  const ready = pulled >= PULL_TRIGGER_PX;
  return (
    <div ref={box} onTouchStart={begin} onTouchMove={move} onTouchEnd={end} onTouchCancel={() => { startY.current = null; setPulled(0); }} className="relative h-full min-h-0">
      {pulled > 0 ? (
        <div data-testid="jalar-para-actualizar" role="status" style={{ height: pulled }} className="flex items-center justify-center gap-2 overflow-hidden text-[13px] font-semibold text-on-surface-variant">
          {ready ? <RefreshCw size={16} /> : <ArrowDown size={16} />}
          {ready ? 'Suelta para actualizar' : 'Desliza para actualizar'}
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
