import { useEffect, useRef, type RefObject } from 'react';

/** What a click may land on without closing the panel: a dialog or a menu it opened (portals live outside it). */
const ALWAYS_IGNORED = '[role="dialog"], [data-radix-popper-content-wrapper]';

/**
 * A floating panel closes with a click outside it or Escape (José, 21/10:
 * «muchas ventanas se abren pero no se cierran»). `ignore` is a selector for
 * what toggles it, so that click does not close it and open it again.
 */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void, options: { ignore?: string } = {}): void {
  const latest = useRef({ onClose, ignore: options.ignore });
  latest.current = { onClose, ignore: options.ignore };
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || ref.current?.contains(target)) return;
      if (latest.current.ignore && target.closest?.(latest.current.ignore)) return;
      // A dialog the panel opened is ignored; the dialog the panel lives IN is not (a menu inside a dialog closes on a click beside it).
      const portal = target.closest?.(ALWAYS_IGNORED);
      if (portal && !portal.contains(ref.current)) return;
      latest.current.onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current.onClose();
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, ref]);
}
