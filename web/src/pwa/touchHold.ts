export const HOLD_MS = 450;
/** A finger is never still: past this it is a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 10;
const OPEN_MARK = 'data-touch-open';
const ROW = '.group';

/**
 * Holding a row shows what the mouse shows on hover (spec §3.3): every row with
 * hidden actions is a Tailwind `.group`, so this mark and one CSS rule reach them
 * all without touching each component.
 */
export function followTouchHold(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start = { x: 0, y: 0 };
  let open: Element | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const close = () => {
    open?.removeAttribute(OPEN_MARK);
    open = null;
  };
  const onStart = (event: TouchEvent) => {
    const row = event.target instanceof Element ? event.target.closest(ROW) : null;
    if (open && open !== row) close();
    cancel();
    if (!row || row === open) return;
    const finger = event.touches[0];
    start = { x: finger?.clientX ?? 0, y: finger?.clientY ?? 0 };
    timer = setTimeout(() => {
      timer = null;
      row.setAttribute(OPEN_MARK, '');
      open = row;
    }, HOLD_MS);
  };
  const onMove = (event: TouchEvent) => {
    const finger = event.touches[0];
    if (finger && Math.hypot(finger.clientX - start.x, finger.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
  };
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', cancel, { passive: true });
  document.addEventListener('touchcancel', cancel, { passive: true });
  return () => {
    cancel();
    close();
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', cancel);
    document.removeEventListener('touchcancel', cancel);
  };
}
